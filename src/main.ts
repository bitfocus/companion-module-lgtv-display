import {
	InstanceBase,
	InstanceStatus,
	runEntrypoint,
	type DropdownChoice,
	type SomeCompanionConfigField,
} from '@companion-module/base'
import { GetConfigFields, type ModuleConfig } from './config.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions } from './actions.js'
import { UpdateFeedbacks } from './feedbacks.js'
import { UpdateVariableDefinitions, UpdateVariableValues } from './variables.js'
import { UpdatePresets } from './presets.js'

import { LGTV, EnergySavingLevels, Keys, PowerStates, DefaultSettings, ResponseParseError } from 'lgtv-ip-control'

import PQueue from 'p-queue'

import { createSocket } from 'node:dgram'

export interface FeedbackState {
	powerState: PowerStates
	currentApp: string
	currentVolume: number | null
	isMuted: boolean
	ipControlEnabled: boolean
	signal: boolean | undefined
	hdcpVersion: string
	hdcpStatus: string
}

const POLL_MIN = 250
const POLL_MAX = 60000
const POLL_DEFAULT = 2000

// A TV that drops off the network (e.g. a Wi-Fi TV in standby) can leave the socket
// open with every read timing out. After this many failed polls in a row the TV is
// treated as gone, so its last known state isn't kept forever.
const MAX_FAILED_POLLS = 2
const RECONNECT_MS = 30000
// After Power On, retry the connection quickly for a while so feedback catches up.
const RECONNECT_FAST_MS = 3000
const FAST_RECONNECT_WINDOW_MS = 120000
// Cap every task on the socket. A disconnect can strand an in-flight read whose
// promise never settles (lgtv-ip-control#160), which would block the queue forever.
const QUEUE_TASK_TIMEOUT_MS = 25000
const WOL_ROUNDS = 3
const WOL_SPACING_MS = 500

const MAC_RE = /([0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2}/

function normalizeMac(value: string | undefined | null): string {
	const match = (value ?? '').match(MAC_RE)
	return match ? match[0].replace(/-/g, ':').toUpperCase() : ''
}

// Blank means no encryption; the library then uses clear text.
function normalizeKeycode(value: string | undefined | null): string | null {
	return (value ?? '').trim().toUpperCase() || null
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

export class ModuleInstance extends InstanceBase<ModuleConfig> {
	config!: ModuleConfig // Setup in init()

	lgtv?: LGTV
	DefaultSettings: typeof DefaultSettings = { ...DefaultSettings }

	available_keys: DropdownChoice[] = []
	available_energyLevels: DropdownChoice[] = []

	feedbackState: FeedbackState = {
		powerState: PowerStates.unknown,
		currentApp: '',
		currentVolume: null,
		isMuted: false,
		ipControlEnabled: false,
		signal: undefined,
		hdcpVersion: '',
		hdcpStatus: '',
	}

	private reconnectTimer: NodeJS.Timeout | null = null
	private feedbackPollTimer: NodeJS.Timeout | undefined = undefined
	private feedbackPollInFlight = false
	// Failed connects in a row, so the "TV may be off" notice logs only once.
	private connectFailures = 0
	private commandQueue = this.newCommandQueue()
	private failedPolls = 0
	private connectionConfirmed = false
	private fastReconnectUntil = 0

	constructor(internal: unknown) {
		super(internal)
	}

	async init(config: ModuleConfig): Promise<void> {
		await this.configUpdated(config)
	}

	async configUpdated(config: ModuleConfig): Promise<void> {
		this.config = config
		this.connectFailures = 0
		this.failedPolls = 0
		this.stopFeedbackPolling()

		this.updateFeedbacks()
		this.updateVariableDefinitions()
		this.updatePresets()

		this.updateStatus(InstanceStatus.Connecting)
		this.initLGTV()
		this.initConnection()
	}

	async destroy(): Promise<void> {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer)
			this.reconnectTimer = null
		}
		this.stopFeedbackPolling()
		this.commandQueue.clear()
		if (this.lgtv) {
			this.lgtv.disconnect()
			delete this.lgtv
		}
		this.log('debug', `Destroying instance ${this.id}`)
	}

	getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	updateActions(): void {
		UpdateActions(this)
	}

	updateFeedbacks(): void {
		UpdateFeedbacks(this)
	}

	updateVariableDefinitions(): void {
		UpdateVariableDefinitions(this)
	}

	updatePresets(): void {
		UpdatePresets(this)
	}

	checkVariables(): void {
		UpdateVariableValues(this)
	}

	initLGTV(): void {
		const camelToTitle = (str: string): string => str.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())
		this.available_keys = Object.entries(Keys).map(([key, value]) => ({ id: value, label: camelToTitle(key) }))
		this.available_energyLevels = Object.keys(EnergySavingLevels).map((key) => ({ id: key, label: camelToTitle(key) }))
		// Re-export actions now that the dropdown choices are populated.
		this.updateActions()
	}

	initConnection(): void {
		// Clear any existing reconnect timer
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer)
			this.reconnectTimer = null
		}
		this.stopFeedbackPolling()
		// Drop any commands still queued against the socket we're about to replace. A task
		// already running may be stranded by the disconnect, so start a fresh queue rather
		// than waiting for it to time out.
		this.commandQueue.clear()
		this.commandQueue = this.newCommandQueue()
		if (this.lgtv !== undefined) {
			this.lgtv.disconnect()
			delete this.lgtv
		}
		this.updateStatus(InstanceStatus.Connecting)
		this.DefaultSettings = { ...DefaultSettings }
		if (this.config.wol_ip) {
			this.DefaultSettings.networkWolAddress = this.config.wol_ip
		} else {
			this.DefaultSettings.networkWolAddress = '255.255.255.255' // Default value if invalid
		}

		if (this.config.host && this.config.mac) {
			this.log('debug', `Connecting to ${this.config.host}`)
			try {
				const lgtv = new LGTV(
					this.config.host,
					this.config.mac,
					normalizeKeycode(this.config.code),
					this.DefaultSettings,
				)
				this.lgtv = lgtv
				lgtv
					.connect()
					.then(() => {
						if (lgtv !== this.lgtv) {
							lgtv.disconnect()
							return
						}
						this.failedPolls = 0
						this.fastReconnectUntil = 0
						// The TCP connect alone doesn't prove the TV answers (e.g. a missing keycode
						// on an encrypted TV), so report Connected only after the first good poll.
						this.connectionConfirmed = false
						this.log('debug', `Socket open to ${this.config.host}`)
						void this.readMacAddresses()
						this.startFeedbackPolling()
					})
					.catch((error: unknown) => {
						if (lgtv !== this.lgtv) return
						// A failed connect usually just means the TV is powered off.
						this.onConnectionLost(error)
					})
			} catch (error) {
				this.onConnectionLost(error)
			}
		} else {
			this.stopFeedbackPolling()
			this.resetFeedbackState()
			this.updateStatus(InstanceStatus.BadConfig)
		}
	}

	// Treat a lost/failed connection as an off TV: show "Disconnected", log once, and
	// keep retrying quietly so we reconnect automatically when the TV returns.
	private onConnectionLost(error: unknown): void {
		this.stopFeedbackPolling()
		this.resetFeedbackState()
		this.lgtv?.disconnect()

		if (this.connectFailures === 0) {
			const keycodeHint = normalizeKeycode(this.config.code)
				? ''
				: ' If this TV requires encryption, enter its Keycode in the module settings.'
			this.log(
				'info',
				`Not connected to ${this.config.host}. The TV may be powered off — retrying every 30s.${keycodeHint} (${errorMessage(error)})`,
			)
		} else {
			this.log('debug', `Still not connected to ${this.config.host}: ${errorMessage(error)}`)
		}
		this.connectFailures++

		this.updateStatus(InstanceStatus.Disconnected, 'Not connected — the TV may be powered off')

		// Retry every 30s (every 3s for a while after Power On); guard against
		// scheduling more than one timer.
		if (!this.reconnectTimer) {
			const delay = Date.now() < this.fastReconnectUntil ? RECONNECT_FAST_MS : RECONNECT_MS
			this.reconnectTimer = setTimeout(() => this.initConnection(), delay)
		}
	}

	// Ask the TV for its own MACs. The hidden menu often shows the wired MAC even when
	// the TV is on Wi-Fi, and Wake-On-LAN only works on the active interface. Save what
	// the TV reports (only when it changed) so Power On can wake it, and warn when the
	// configured MAC is neither.
	private async readMacAddresses(): Promise<void> {
		const lgtv = this.lgtv
		if (!lgtv) return
		const reported = { wifi: '', wired: '' }
		try {
			await this.runExclusive(async () => {
				for (const type of ['wifi', 'wired'] as const) {
					try {
						reported[type] = normalizeMac(await lgtv.getMacAddress(type))
					} catch (error) {
						this.log('debug', `Could not read ${type} MAC: ${errorMessage(error)}`)
					}
				}
			})
		} catch {
			return
		}
		if (lgtv !== this.lgtv || (!reported.wifi && !reported.wired)) return

		this.log('debug', `TV reports Wi-Fi MAC ${reported.wifi || '?'} and wired MAC ${reported.wired || '?'}`)
		const configured = normalizeMac(this.config.mac)
		if (configured !== reported.wifi && configured !== reported.wired) {
			this.log(
				'warn',
				`Configured MAC ${configured || '(none)'} is not one of the TV's own MACs (Wi-Fi ${reported.wifi || '?'}, wired ${reported.wired || '?'}). Power On will also wake the reported MACs.`,
			)
		}
		if (
			(reported.wifi || '') !== (this.config.detected_mac_wifi ?? '') ||
			(reported.wired || '') !== (this.config.detected_mac_wired ?? '')
		) {
			this.config = { ...this.config, detected_mac_wifi: reported.wifi, detected_mac_wired: reported.wired }
			this.saveConfig(this.config)
		}
	}

	// Clear cached TV state and refresh feedbacks/variables (used when not connected).
	private resetFeedbackState(): void {
		this.feedbackState = {
			powerState: PowerStates.unknown,
			currentApp: '',
			currentVolume: null,
			isMuted: false,
			ipControlEnabled: false,
			signal: undefined,
			hdcpVersion: '',
			hdcpStatus: '',
		}
		this.checkFeedbacks()
		this.checkVariables()
	}

	// Run a TV command (or a read-then-write sequence) with exclusive access to the
	// socket, so it never interleaves with the poll loop or another action.
	private newCommandQueue(): PQueue {
		return new PQueue({ concurrency: 1, timeout: QUEUE_TASK_TIMEOUT_MS })
	}

	async runExclusive<T>(task: () => Promise<T>): Promise<T> {
		return this.commandQueue.add(task)
	}

	// The library's powerOn() swallows every send error and can send before the
	// socket has SO_BROADCAST set, so WoL failures look like nothing happened.
	// Send the magic packet ourselves instead, and log what actually happened.
	// A single packet is easily lost on Wi-Fi, so send a few rounds.
	sendWakeOnLan(): void {
		const mac = this.config?.mac?.trim()
		if (!mac || !/^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/.test(mac)) {
			this.log('error', `Power on: cannot send Wake-On-LAN, MAC address is missing or invalid ('${mac ?? ''}')`)
			return
		}
		// Also wake the MACs the TV reported about itself, in case the configured one
		// belongs to the inactive interface.
		const macs = [normalizeMac(mac), this.config.detected_mac_wifi ?? '', this.config.detected_mac_wired ?? ''].filter(
			(m, i, all) => m && all.indexOf(m) === i,
		)

		const address = this.config?.wol_ip?.trim() || '255.255.255.255'
		const port = 9

		const packets = macs.map((m) => {
			const macBytes = Buffer.from(m.split(':').map((block) => parseInt(block, 16)))
			const magicPacket = Buffer.alloc(6 + 16 * 6, 0xff)
			for (let i = 0; i < 16; i++) {
				macBytes.copy(magicPacket, 6 + i * 6)
			}
			return magicPacket
		})

		const socket = createSocket('udp4')
		let closed = false
		const close = (): void => {
			if (closed) return
			closed = true
			socket.close()
		}
		socket.on('error', (error) => {
			this.log('error', `Power on: Wake-On-LAN socket error: ${errorMessage(error)}`)
			close()
		})
		// Bind explicitly so SO_BROADCAST is set before the packets go out.
		socket.bind(() => {
			socket.setBroadcast(true)
			const send = (round: number): void => {
				if (closed) return
				let pending = packets.length
				for (const packet of packets) {
					socket.send(packet, port, address, (error) => {
						if (error) {
							this.log('error', `Power on: Wake-On-LAN to ${address}:${port} failed: ${errorMessage(error)}`)
							close()
							return
						}
						if (--pending > 0) return
						if (round < WOL_ROUNDS) {
							setTimeout(() => send(round + 1), WOL_SPACING_MS)
						} else {
							this.log(
								'debug',
								`Power on: Wake-On-LAN sent ${WOL_ROUNDS}x to ${address}:${port} for ${macs.join(', ')}`,
							)
							close()
						}
					})
				}
			}
			send(1)
		})

		// Reconnect quickly while the TV boots.
		this.fastReconnectUntil = Date.now() + FAST_RECONNECT_WINDOW_MS
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer)
			this.reconnectTimer = setTimeout(() => this.initConnection(), RECONNECT_FAST_MS)
		}
	}

	startFeedbackPolling(): void {
		this.stopFeedbackPolling()

		const requested = Math.floor(Number(this.config?.poll_interval))

		// A value of 0 disables periodic polling. Still run a single update so
		// feedbacks/variables reflect the current state right after connecting.
		if (requested === 0) {
			void this.updateFeedbackState()
			return
		}

		const interval = Number.isFinite(requested) ? Math.min(POLL_MAX, Math.max(POLL_MIN, requested)) : POLL_DEFAULT

		this.feedbackPollTimer = setInterval(() => {
			void this.updateFeedbackState()
		}, interval)
		void this.updateFeedbackState()
	}

	stopFeedbackPolling(): void {
		if (this.feedbackPollTimer) {
			clearInterval(this.feedbackPollTimer)
			this.feedbackPollTimer = undefined
		}
		this.feedbackPollInFlight = false
	}

	async updateFeedbackState(): Promise<void> {
		// Skip if a poll is already running so we don't pile up redundant reads.
		if (this.feedbackPollInFlight) {
			return
		}
		this.feedbackPollInFlight = true

		try {
			if (!this.lgtv || !this.lgtv.connected) {
				this.resetFeedbackState()
				// Connection dropped mid-session: enter the reconnect loop instead of
				// polling a dead socket (guarded so we don't double-schedule).
				if (this.lgtv && !this.reconnectTimer) {
					this.onConnectionLost(new Error('connection lost'))
				}
				return
			}

			const lgtv = this.lgtv
			const nextState: FeedbackState = { ...this.feedbackState }

			// Read everything in one exclusive turn so the four commands stay together
			// on the socket instead of interleaving with an action's command. On a
			// transient read error we keep the previous value rather than blanking it,
			// which avoids the brief "all variables go empty" blip; a real disconnect
			// is handled by the connected check above.
			let powerReadFailed = false
			try {
				await this.runExclusive(async () => {
					// getCurrentAppDetails runs the same CURRENT_APP command as getCurrentApp
					// but also returns signal/HDCP info, so we get those for no extra round trip.
					try {
						const details = await lgtv.getCurrentAppDetails()
						if (details === null) {
							nextState.currentApp = ''
							nextState.powerState = PowerStates.off
							nextState.signal = undefined
							nextState.hdcpVersion = ''
							nextState.hdcpStatus = ''
						} else {
							nextState.currentApp = details.app ?? ''
							nextState.powerState = PowerStates.on
							nextState.signal = details.signal
							nextState.hdcpVersion = details.hdcpVersion ?? ''
							nextState.hdcpStatus = details.hdcpStatus ?? ''
						}
					} catch (error) {
						// Keep previous app/power/signal/HDCP values. A garbled reply means the
						// TV is still there; a timeout or socket error means it may be gone,
						// so skip the other reads and count a failed poll.
						if (!(error instanceof ResponseParseError)) {
							powerReadFailed = true
							return
						}
					}

					try {
						nextState.currentVolume = await lgtv.getCurrentVolume()
					} catch {
						// keep previous volume
					}

					try {
						nextState.isMuted = await lgtv.getMuteState()
					} catch {
						// keep previous mute state
					}

					// getIpControlState resolves true or throws; a throw means "not enabled",
					// so false here is the intended reading, not a transient failure.
					try {
						nextState.ipControlEnabled = await lgtv.getIpControlState()
					} catch {
						nextState.ipControlEnabled = false
					}
				})
			} catch {
				// The queued read timed out or was dropped.
				powerReadFailed = true
			}

			// The connection was replaced while we were reading: ignore this result.
			if (lgtv !== this.lgtv) return

			if (powerReadFailed) {
				this.failedPolls++
				if (this.failedPolls >= MAX_FAILED_POLLS) {
					this.failedPolls = 0
					this.onConnectionLost(new Error(`no response to ${MAX_FAILED_POLLS} polls in a row`))
					return
				}
			} else {
				this.failedPolls = 0
				if (!this.connectionConfirmed) {
					this.connectionConfirmed = true
					this.connectFailures = 0
					this.log('info', `Connected to ${this.config.host}`)
					this.updateStatus(InstanceStatus.Ok)
				}
			}

			this.feedbackState = nextState
			this.checkFeedbacks()
			this.checkVariables()
		} finally {
			this.feedbackPollInFlight = false
		}
	}
}

runEntrypoint(ModuleInstance, UpgradeScripts)
