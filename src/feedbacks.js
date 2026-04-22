const { combineRgb } = require('@companion-module/base')
const { Apps, PowerStates } = require('lgtv-ip-control')

module.exports = {
	initFeedbacks: function () {
		let self = this
		let feedbacks = {}

		feedbacks.powerState = {
			type: 'boolean',
			name: 'Power state',
			description: 'True when the TV power state matches the selected state',
			defaultStyle: {
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 153, 0),
			},
			options: [
				{
					type: 'dropdown',
					id: 'state',
					label: 'State',
					default: PowerStates.on,
					choices: [
						{ id: PowerStates.on, label: 'On' },
						{ id: PowerStates.off, label: 'Off' },
						{ id: PowerStates.unknown, label: 'Unknown' },
					],
				},
			],
			callback: function (feedback) {
				return self.feedbackState?.powerState === feedback.options.state
			},
		}

		feedbacks.muteState = {
			type: 'boolean',
			name: 'Mute state',
			description: 'True when mute state matches the selected state',
			defaultStyle: {
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 153, 0),
			},
			options: [
				{
					type: 'dropdown',
					id: 'muted',
					label: 'Muted',
					default: 'true',
					choices: [
						{ id: 'true', label: 'Muted' },
						{ id: 'false', label: 'Unmuted' },
					],
				},
			],
			callback: function (feedback) {
				return String(self.feedbackState?.isMuted ?? false) === feedback.options.muted
			},
		}

		feedbacks.ipControl = {
			type: 'boolean',
			name: 'IP Control enabled',
			description: 'True when GET_IPCONTROL_STATE returns ON',
			defaultStyle: {
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 153, 0),
			},
			options: [],
			callback: function () {
				return self.feedbackState?.ipControlEnabled === true
			},
		}

		feedbacks.currentVolume = {
			type: 'boolean',
			name: 'Volume compare',
			description: 'Compares current volume against a value',
			defaultStyle: {
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 153, 0),
			},
			options: [
				{
					type: 'dropdown',
					id: 'op',
					label: 'Operator',
					default: 'eq',
					choices: [
						{ id: 'eq', label: '=' },
						{ id: 'ne', label: '!=' },
						{ id: 'gt', label: '>' },
						{ id: 'gte', label: '>=' },
						{ id: 'lt', label: '<' },
						{ id: 'lte', label: '<=' },
					],
				},
				{
					type: 'number',
					id: 'volume',
					label: 'Volume (0-100)',
					default: 50,
					min: 0,
					max: 100,
					required: true,
				},
			],
			callback: function (feedback) {
				const currentVolume = self.feedbackState?.currentVolume
				if (typeof currentVolume !== 'number') {
					return false
				}

				const targetVolume = Number(feedback.options.volume)
				switch (feedback.options.op) {
					case 'eq':
						return currentVolume === targetVolume
					case 'ne':
						return currentVolume !== targetVolume
					case 'gt':
						return currentVolume > targetVolume
					case 'gte':
						return currentVolume >= targetVolume
					case 'lt':
						return currentVolume < targetVolume
					case 'lte':
						return currentVolume <= targetVolume
					default:
						return false
				}
			},
		}

		feedbacks.currentApp = {
			type: 'boolean',
			name: 'Current app',
			description: 'True when the current app matches the selected app',
			defaultStyle: {
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 153, 0),
			},
			options: [
				{
					type: 'dropdown',
					id: 'app',
					label: 'App',
					default: Apps.netflix,
					choices: [
						...Object.entries(Apps).map(([key, value]) => ({ id: value, label: key })),
						{ id: '__custom__', label: 'Custom App ID (below)' },
					],
				},
				{
					type: 'textinput',
					id: 'customAppId',
					label: 'Custom App ID',
					default: '',
				},
			],
			callback: function (feedback) {
				const currentApp = String(self.feedbackState?.currentApp ?? '').trim()
				const selectedApp = feedback.options.app === '__custom__'
					? String(feedback.options.customAppId ?? '').trim()
					: String(feedback.options.app ?? '').trim()

				if (!selectedApp || !currentApp) {
					return false
				}

				return currentApp === selectedApp
			},
		}

		self.setFeedbackDefinitions(feedbacks)
		self.checkFeedbacks()
	},

	startFeedbackPolling: function () {
		let self = this
		self.stopFeedbackPolling()
		const pollInterval = Math.floor(Number(self.config?.poll_interval))
		const interval = Number.isFinite(pollInterval) && pollInterval >= 250 && pollInterval <= 60000 ? pollInterval : 2000
		self.feedbackPollTimer = setInterval(() => {
			self.updateFeedbackState()
		}, interval)
		self.updateFeedbackState()
	},

	stopFeedbackPolling: function () {
		let self = this
		if (self.feedbackPollTimer) {
			clearInterval(self.feedbackPollTimer)
			self.feedbackPollTimer = undefined
		}
		self.feedbackPollInFlight = false
	},

	updateFeedbackState: async function () {
		let self = this
		if (self.feedbackPollInFlight) {
			return
		}
		self.feedbackPollInFlight = true

		try {
			if (!self.lgtv || !self.lgtv.connected) {
				self.feedbackState = {
					...self.feedbackState,
					powerState: PowerStates.unknown,
					currentApp: '',
					currentVolume: null,
					isMuted: false,
					ipControlEnabled: false,
				}
				self.checkFeedbacks()
				return
			}

			let nextState = {
				...self.feedbackState,
			}

			try {
				const currentApp = await self.lgtv.getCurrentApp()
				nextState.currentApp = currentApp || ''
				nextState.powerState = currentApp === null ? PowerStates.off : PowerStates.on
			} catch (error) {
				nextState.currentApp = ''
				nextState.powerState = PowerStates.unknown
			}

			try {
				nextState.currentVolume = await self.lgtv.getCurrentVolume()
			} catch (error) {
				nextState.currentVolume = null
			}

			try {
				nextState.isMuted = await self.lgtv.getMuteState()
			} catch (error) {
				nextState.isMuted = false
			}

			try {
				nextState.ipControlEnabled = await self.lgtv.getIpControlState()
			} catch (error) {
				nextState.ipControlEnabled = false
			}

			self.feedbackState = nextState
			self.checkFeedbacks()
		} finally {
			self.feedbackPollInFlight = false
		}
	},
}
