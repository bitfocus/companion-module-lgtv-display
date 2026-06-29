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
	private commandQueue = new PQueue({ concurrency: 1 })

	constructor(internal: unknown) {
		super(internal)
	}

	async init(config: ModuleConfig): Promise<void> {
		await this.configUpdated(config)
	}

	async configUpdated(config: ModuleConfig): Promise<void> {
		this.config = config
		this.connectFailures = 0
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
		// Drop any commands still queued against the socket we're about to replace.
		this.commandQueue.clear()
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
				this.lgtv = new LGTV(this.config.host, this.config.mac, this.config.code, this.DefaultSettings)
				this.lgtv
					.connect()
					.then(() => {
						this.connectFailures = 0
						this.log('info', `Connected to ${this.config.host}`)
						this.updateStatus(InstanceStatus.Ok)
						this.startFeedbackPolling()
					})
					.catch((error: unknown) => {
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

		// Retry every 30s; guard against scheduling more than one timer.
		if (!this.reconnectTimer) {
			this.reconnectTimer = setTimeout(() => this.initConnection(), 30000)
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
	async runExclusive<T>(task: () => Promise<T>): Promise<T> {
		return this.commandQueue.add(task)
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
					// keep previous app/power/signal/HDCP values
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

			this.feedbackState = nextState
			this.checkFeedbacks()
			this.checkVariables()
		} finally {
			this.feedbackPollInFlight = false
		}
	}
}

runEntrypoint(ModuleInstance, UpgradeScripts)
