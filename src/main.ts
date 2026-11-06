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

import { LGTV, EnergySavingLevels, Keys, PowerStates, DefaultSettings } from 'lgtv-ip-control'

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

// A TV that drops off the network (standby on Wi-Fi) leaves the TCP socket open
// with every read timing out. After this many failed polls in a row we treat the
// TV as gone instead of keeping the last known values.
const MAX_FAILED_POLLS = 2
const RECONNECT_SLOW_MS = 30000
const RECONNECT_FAST_MS = 3000
// After Power On, retry the connection quickly for this long.
const FAST_RECONNECT_WINDOW_MS = 120000
// Wake-On-LAN burst: rounds, spacing, and UDP ports.
const WOL_REPEATS = 5
const WOL_SPACING_MS = 500
const WOL_PORTS = [9, 7]
// Every task on the socket is capped so a library promise that never settles
// (its listeners were dropped by a disconnect) can't block the queue forever.
// The poll runs four reads of up to 5 s each.
const QUEUE_TASK_TIMEOUT_MS = 25000
// Watchdog: restarts a stalled reconnect loop or a connection whose polls stopped.
const WATCHDOG_MS = 10000
const CONNECT_STALL_MS = 20000
const POLL_STALL_MS = 30000
const MAC_RE = /([0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2}/

function normalizeMac(value: string | undefined | null): string {
	const match = (value ?? '').match(MAC_RE)
	return match ? match[0].replace(/-/g, ':').toUpperCase() : ''
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
	private commandQueue = ModuleInstance.newQueue()
	// Bumped on every connect attempt; results from older attempts are ignored.
	private connectGen = 0
	private connectStartedAt = 0
	private lastGoodPoll = 0
	private watchdogTimer: NodeJS.Timeout | undefined = undefined
	private failedPolls = 0
	private fastReconnectUntil = 0
	private wolTimers: NodeJS.Timeout[] = []
	// MACs the TV reported about itself (GET_MACADDRESS), kept across reconnects.
	detectedMacs: { wifi: string; wired: string } = { wifi: '', wired: '' }
	lastError = ''

	constructor(internal: unknown) {
		super(internal)
	}

	private static newQueue(): PQueue {
		return new PQueue({ concurrency: 1, timeout: QUEUE_TASK_TIMEOUT_MS })
	}

	// Throw away the queue (including a task that may be stuck) and start a fresh one.
	private resetQueue(): void {
		this.commandQueue.clear()
		this.commandQueue = ModuleInstance.newQueue()
	}

	async init(config: ModuleConfig): Promise<void> {
		await this.configUpdated(config)
	}

	async configUpdated(config: ModuleConfig): Promise<void> {
		if (this.config && this.config.host !== config.host) {
			this.detectedMacs = { wifi: '', wired: '' }
		}
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
		this.startWatchdog()
	}

	private startWatchdog(): void {
		if (this.watchdogTimer) clearInterval(this.watchdogTimer)
		this.watchdogTimer = setInterval(() => this.watchdog(), WATCHDOG_MS)
	}

	// Safety net for the reconnect loop. If we're not connected, no retry is
	// scheduled and no connect attempt is running (or one has hung), start one.
	// If we're connected but no poll has succeeded for a while, drop the connection.
	private watchdog(): void {
		if (!this.config?.host || !this.config?.mac || !this.config?.code) return
		const now = Date.now()
		if (this.isConnected()) {
			const pollingOn = Math.floor(Number(this.config.poll_interval)) !== 0
			if (pollingOn && this.lastGoodPoll && now - this.lastGoodPoll > POLL_STALL_MS) {
				this.log('debug', `Watchdog: no successful poll of ${this.config.host} for ${POLL_STALL_MS / 1000}s`)
				this.onConnectionLost(new Error('polls stalled'))
			}
			return
		}
		if (this.reconnectTimer) return
		if (this.connectStartedAt && now - this.connectStartedAt < CONNECT_STALL_MS) return
		this.log('debug', `Watchdog: reconnect loop for ${this.config.host} had stalled, restarting it`)
		this.initConnection()
	}

	async destroy(): Promise<void> {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer)
			this.reconnectTimer = null
		}
		if (this.watchdogTimer) {
			clearInterval(this.watchdogTimer)
			this.watchdogTimer = undefined
		}
		this.stopFeedbackPolling()
		this.clearWolTimers()
		this.commandQueue.clear()
		if (this.lgtv) {
			this.lgtv.disconnect()
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

	isConnected(): boolean {
		return !!this.lgtv && this.lgtv.connected
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
		// Drop any commands still queued (or stuck) against the socket we're about to replace.
		this.resetQueue()
		const gen = ++this.connectGen
		this.connectStartedAt = 0
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

		if (this.config.host && this.config.mac && this.config.code) {
			this.log('debug', `Connecting to ${this.config.host}`)
			try {
				const lgtv = new LGTV(this.config.host, this.config.mac, this.config.code, this.DefaultSettings)
				this.lgtv = lgtv
				this.connectStartedAt = Date.now()
				lgtv
					.connect()
					.then(() => {
						if (gen !== this.connectGen) {
							// A newer attempt replaced this one; close the orphaned socket.
							lgtv.disconnect()
							return
						}
						this.connectStartedAt = 0
						this.lastGoodPoll = Date.now()
						this.connectFailures = 0
						this.failedPolls = 0
						this.fastReconnectUntil = 0
						this.log('info', `Connected to ${this.config.host}`)
						this.updateStatus(InstanceStatus.Ok)
						void this.readMacAddresses()
						this.startFeedbackPolling()
					})
					.catch((error: unknown) => {
						if (gen !== this.connectGen) return
						this.connectStartedAt = 0
						// A failed connect usually just means the TV is powered off.
						this.onConnectionLost(error)
					})
			} catch (error) {
				this.connectStartedAt = 0
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
	// Called after the TV acknowledged Power Off. Show it as off right away and
	// close the socket (the TV will drop off Wi-Fi anyway) instead of waiting for
	// polls to time out. The reconnect loop picks it up again when it comes back.
	markPoweredOff(): void {
		this.connectFailures = 1 // skip the "TV may be off" info log, this was expected
		this.onConnectionLost(new Error('powered off'))
		this.feedbackState = { ...this.feedbackState, powerState: PowerStates.off }
		this.checkFeedbacks()
		this.checkVariables()
	}

	private onConnectionLost(error: unknown): void {
		this.stopFeedbackPolling()
		// Close the old socket so a half-dead connection can't keep reporting "connected".
		if (this.lgtv) {
			try {
				this.lgtv.disconnect()
			} catch {
				// ignore
			}
		}
		// Invalidate any connect attempt still running, and drop queued or stuck tasks.
		this.connectGen++
		this.connectStartedAt = 0
		this.resetQueue()
		this.resetFeedbackState()

		if (this.connectFailures === 0) {
			this.log(
				'info',
				`Not connected to ${this.config.host}. The TV may be powered off — retrying every 30s. (${errorMessage(error)})`,
			)
		} else {
			this.log('debug', `Still not connected to ${this.config.host}: ${errorMessage(error)}`)
		}
		this.connectFailures++

		this.updateStatus(InstanceStatus.Disconnected, 'Not connected — the TV may be powered off')

		// Retry every 30s (every 3s for a while after Power On); guard against
		// scheduling more than one timer.
		if (!this.reconnectTimer) {
			const delay = Date.now() < this.fastReconnectUntil ? RECONNECT_FAST_MS : RECONNECT_SLOW_MS
			this.reconnectTimer = setTimeout(() => this.initConnection(), delay)
		}
	}

	// Ask the TV for its own MACs. The hidden menu tends to show the wired MAC even
	// when the TV runs on Wi-Fi, and Wake-On-LAN only works on the active interface.
	private async readMacAddresses(): Promise<void> {
		const lgtv = this.lgtv
		if (!lgtv) return
		try {
			await this.runExclusive(async () => {
				for (const type of ['wifi', 'wired'] as const) {
					try {
						const mac = normalizeMac(await lgtv.getMacAddress(type))
						if (mac) this.detectedMacs[type] = mac
					} catch (error) {
						this.log('debug', `Could not read ${type} MAC: ${errorMessage(error)}`)
					}
				}
			})
		} catch {
			return
		}
		const configured = [normalizeMac(this.config.mac), normalizeMac(this.config.mac2)].filter(Boolean)
		const reported = [this.detectedMacs.wifi, this.detectedMacs.wired].filter(Boolean)
		this.log(
			'info',
			`TV reports Wi-Fi MAC ${this.detectedMacs.wifi || '?'} and wired MAC ${this.detectedMacs.wired || '?'}`,
		)
		if (reported.length && !reported.some((mac) => configured.includes(mac))) {
			this.log(
				'warn',
				`None of the configured MACs (${configured.join(', ') || 'none'}) match the TV's own MACs. Power On also wakes the reported ones while this module keeps running, but put the right MAC in the config so it survives a restart.`,
			)
		}
		this.checkVariables()
	}

	private clearWolTimers(): void {
		for (const timer of this.wolTimers) clearTimeout(timer)
		this.wolTimers = []
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
	async runExclusive<T>(task: () => Promise<T>): Promise<T> {
		try {
			return await this.commandQueue.add(task)
		} catch (error) {
			// Make command failures visible: the TV's reply (e.g. "response not 'OK': NG")
			// goes to the log and to the last_error variable.
			this.lastError = `${new Date().toISOString().slice(11, 19)} ${errorMessage(error)}`
			this.log('warn', `Command to ${this.config?.host} failed: ${errorMessage(error)}`)
			this.checkVariables()
			throw error
		}
	}

	// The library's powerOn() swallows every send error and sends a single packet.
	// Over Wi-Fi one packet is easily lost, so send a short burst: to every known
	// MAC (config MAC, second MAC and the MACs the TV reported), to the configured
	// broadcast address, the limited broadcast and the TV's own IP, on ports 9 and 7.
	// Then retry the connection quickly so feedback catches up within seconds.
	sendWakeOnLan(): void {
		const macs = [
			normalizeMac(this.config?.mac),
			normalizeMac(this.config?.mac2),
			this.detectedMacs.wifi,
			this.detectedMacs.wired,
		].filter((mac, i, all) => mac && all.indexOf(mac) === i)
		if (macs.length === 0) {
			this.log(
				'error',
				`Power on: cannot send Wake-On-LAN, MAC address is missing or invalid ('${this.config?.mac ?? ''}')`,
			)
			return
		}

		const addresses = [
			this.config?.wol_ip?.trim() || '255.255.255.255',
			'255.255.255.255',
			this.config?.host?.trim() || '',
		].filter((address, i, all) => address && all.indexOf(address) === i)

		const packets = macs.map((mac) => {
			const macBytes = Buffer.from(mac.split(':').map((block) => parseInt(block, 16)))
			const magicPacket = Buffer.alloc(6 + 16 * 6, 0xff)
			for (let i = 0; i < 16; i++) {
				macBytes.copy(magicPacket, 6 + i * 6)
			}
			return magicPacket
		})

		this.log(
			'info',
			`Power on: Wake-On-LAN burst for ${macs.join(', ')} to ${addresses.join(', ')} ports ${WOL_PORTS.join('/')}`,
		)

		const sendRound = (round: number): void => {
			const socket = createSocket('udp4')
			let pending = packets.length * addresses.length * WOL_PORTS.length
			let closed = false
			const close = (): void => {
				if (closed) return
				closed = true
				try {
					socket.close()
				} catch {
					// already closed
				}
			}
			socket.on('error', (error) => {
				this.log('error', `Power on: Wake-On-LAN socket error: ${errorMessage(error)}`)
				close()
			})
			// Bind explicitly so SO_BROADCAST is set before the packets go out.
			socket.bind(() => {
				socket.setBroadcast(true)
				for (const packet of packets) {
					for (const address of addresses) {
						for (const port of WOL_PORTS) {
							socket.send(packet, port, address, (error) => {
								if (error) {
									this.log('debug', `Power on: WoL round ${round} to ${address}:${port} failed: ${errorMessage(error)}`)
								}
								pending--
								if (pending <= 0) close()
							})
						}
					}
				}
			})
		}

		this.clearWolTimers()
		for (let round = 0; round < WOL_REPEATS; round++) {
			this.wolTimers.push(setTimeout(() => sendRound(round + 1), round * WOL_SPACING_MS))
		}

		// Reconnect quickly while the TV boots.
		this.fastReconnectUntil = Date.now() + FAST_RECONNECT_WINDOW_MS
		if (!this.isConnected() && this.reconnectTimer) {
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
					} catch {
						// keep previous app/power/signal/HDCP values (for now; see below)
						powerReadFailed = true
						// The TV didn't answer: skip the other reads so a gone TV is
						// detected in ~5 s per poll instead of ~20 s.
						return
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
				// The whole read timed out or the queue was reset under it.
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
				this.lastGoodPoll = Date.now()
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
