const { InstanceBase, InstanceStatus, Regex, runEntrypoint } = require('@companion-module/base')
const UpgradeScripts = require('./src/upgrades')
const { LGTV, EnergySavingLevels, Keys, DefaultSettings } = require('lgtv-ip-control')

const config = require('./src/config')
const actions = require('./src/actions')
const feedbacks = require('./src/feedbacks')
const variables = require('./src/variables')
const presets = require('./src/presets')

const utils = require('./src/utils')

class LGTVInstance extends InstanceBase {
	constructor(internal) {
		super(internal)
		// Assign the methods from the listed files to this class
		Object.assign(this, {
			...config,
			...actions,
			...feedbacks,
			...variables,
			...presets,
			...utils,
		})
		this.available_keys = []
		this.available_energyLevels = []
		this.feedbackState = {
			powerState: 'unknown',
			currentApp: '',
			currentVolume: null,
			isMuted: false,
			ipControlEnabled: false,
			signal: undefined,
			hdcpVersion: '',
			hdcpStatus: '',
		}
	}

	async init(config) {
		this.configUpdated(config)
	}

	async configUpdated(config) {
		this.config = config
		this.stopFeedbackPolling()

		this.initActions()
		this.initFeedbacks()
		this.initVariables()
		this.initPresets()

		this.updateStatus(InstanceStatus.Connecting)
		this.initLGTV()
		this.initConnection()

		if (this.config.precision) {
			this.precision = parseInt(this.config.precision)
		}
	}

	initLGTV() {
		const camelToTitle = (str) => str.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())
		this.available_keys = Object.entries(Keys).map(([key, value]) => ({ id: value, label: camelToTitle(key) }))
		this.available_energyLevels = Object.keys(EnergySavingLevels).map((key) => ({ id: key, label: camelToTitle(key) }))
		this.initActions()
	}

	initConnection() {
		// Clear any existing reconnect timer
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer)
			this.reconnectTimer = null
		}
		this.stopFeedbackPolling()
		if (this.lgtv !== undefined) {
			this.lgtv.disconnect()
			delete this.lgtv
		}
		this.updateStatus(InstanceStatus.Connecting)
		this.DefaultSettings = Object.assign({}, DefaultSettings)
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
						this.log('info', `Connected to ${this.config.host}`)
						this.updateStatus(InstanceStatus.Ok)
						this.startFeedbackPolling()
					})
					.catch((error) => {
						this.log('error', 'Could not connect to TV.')
						this.log('debug', error.message)
						this.stopFeedbackPolling()
						this.updateFeedbackState()
						this.updateStatus(InstanceStatus.ConnectionFailure, 'Error connecting to device: ' + error.message)
						// Retry every 30s so Companion reconnects automatically once
						// the TV comes back online after WoL wake or standby
						this.reconnectTimer = setTimeout(() => this.initConnection(), 30000)
					})
				this.lgtv.socket
			} catch (error) {
				this.log('error', 'Error connecting to device: ' + error.message)
				this.stopFeedbackPolling()
				this.updateFeedbackState()
				this.updateStatus(InstanceStatus.ConnectionFailure, 'Error connecting to device: ' + error.message)
				this.reconnectTimer = setTimeout(() => this.initConnection(), 30000)
			}
		} else {
			this.stopFeedbackPolling()
			this.updateFeedbackState()
			this.updateStatus(InstanceStatus.BadConfig)
		}
	}

	async destroy() {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer)
			this.reconnectTimer = null
		}
		this.stopFeedbackPolling()
		if (this.lgtv) {
			this.lgtv.disconnect()
		}
		this.log('debug', `Destroying instance ${this.id}`)
	}
}

runEntrypoint(LGTVInstance, UpgradeScripts)
