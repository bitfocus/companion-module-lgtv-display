const { Inputs, EnergySavingLevels, Apps } = require('lgtv-ip-control')
const { appNames, pictureModes, screenMuteModes, toChoices, toChoicesNoCustom } = require('./lookups')

module.exports = {
	initActions: function () {
		let self = this
		let actions = {}

		actions.powerOn = {
			name: 'Power On Display',
			options: [],
			callback: async function (action) {
				if (self.lgtv) {
					self.lgtv.powerOn()
					self.log('info', 'Power on: WoL sent')
					self.updateFeedbackState()
				}
			},
		}

		actions.powerOff = {
			name: 'Power Off Display',
			options: [],
			callback: async function (action) {
				if (self.lgtv) {
					await self.lgtv.powerOff()
					self.log('info', 'Power off')
					self.updateFeedbackState()
				}
			},
		}

		actions.setVolumeMute = {
			name: 'Volume Mute Controls',
			options: [
				{
					type: 'dropdown',
					label: 'Mute',
					id: 'mute',
					default: 'toggle',
					choices: [
						{ id: 'toggle', label: 'Toggle' },
						{ id: 'mute', label: 'Mute' },
						{ id: 'unmute', label: 'Unmute' },
					],
				},
			],
			callback: async function (action) {
				if (self.lgtv) {
					let isMuted
					switch (action.options.mute) {
						case 'mute':
							isMuted = true
							break
						case 'unmute':
							isMuted = false
							break
						default:
							isMuted = !(await self.lgtv.getMuteState())
							break
					}
					await self.lgtv.setVolumeMute(isMuted)
					self.log('info', isMuted ? 'Mute' : 'Unmute')
					self.updateFeedbackState()
				}
			},
		}

		actions.setInput = {
			name: 'Set Input',
			options: [
				{
					type: 'dropdown',
					id: 'input',
					label: 'Input',
					width: 3,
					required: true,
					default: Inputs.dtv,
					choices: [
						{ id: Inputs.dtv, label: 'Digital TV' },
						{ id: Inputs.atv, label: 'Analog TV' },
						{ id: Inputs.cadtv, label: 'Cable Digital TV' },
						{ id: Inputs.catv, label: 'Cable TV' },
						{ id: Inputs.av, label: 'AV Composite' },
						{ id: Inputs.component, label: 'Component' },
						{ id: Inputs.hdmi1, label: 'HDMI 1' },
						{ id: Inputs.hdmi2, label: 'HDMI 2' },
						{ id: Inputs.hdmi3, label: 'HDMI 3' },
						{ id: Inputs.hdmi4, label: 'HDMI 4' },
					],
				},
			],
			callback: async function (action) {
				if (self.lgtv) {
					// Set the input source for the TV
					await self.lgtv.setInput(action.options.input)
					self.log('info', `Input set to ${action.options.input}`)
					self.updateFeedbackState()
				}
			},
		}

		actions.setEnergySaving = {
			name: 'Set Energy Saving',
			options: [
				{
					type: 'dropdown',
					id: 'level',
					label: 'Level',
					width: 3,
					required: true,
					choices: self.available_energyLevels,
				},
			],
			callback: async function (action) {
				if (self.lgtv) {
					// Set the energy saving mode for the TV
					await self.lgtv.setEnergySaving(EnergySavingLevels[action.options.level])
					self.log('info', `Energy Saving set to ${action.options.level}`)
					self.updateFeedbackState()
				}
			},
		}

		actions.sendKey = {
			name: 'Send Key',
			options: [
				{
					type: 'dropdown',
					id: 'key',
					label: 'Key',
					width: 3,
					required: true,
					default: self.available_keys?.length > 0 ? self.available_keys[0].id : undefined,
					choices: self.available_keys,
				},
			],
			callback: async function (action) {
				if (self.lgtv) {
					await self.lgtv.sendKey(action.options.key)
					self.log('info', `Key ${action.options.key} sent to TV`)
					self.updateFeedbackState()
				}
			},
		}

		actions.setVolume = {
			name: 'Set Volume',
			options: [
				{
					type: 'number',
					id: 'vol',
					label: 'Volume Level (0-100)',
					width: 3,
					required: true,
				},
			],
			callback: async function (action) {
				if (self.lgtv) {
					// Set the TV volume
					await self.lgtv.setVolume(action.options.vol)
					self.log('info', `Volume set to ${action.options.vol}`)
					self.updateFeedbackState()
				}
			},
		}

		actions.launchApp = {
			name: 'Launch App',
			options: [
				{
					type: 'dropdown',
					id: 'app',
					label: 'App',
					width: 3,
					required: true,
					default: Apps.netflix,
					choices: toChoices(appNames, 'Custom App ID'),
				},
				{
					type: 'textinput',
					id: 'customAppId',
					label: 'Custom App ID',
					default: '',
					isVisibleExpression: `$(options:app) == '__custom__'`,
				},
			],
			callback: async function (action) {
				if (self.lgtv) {
					const appId =
						action.options.app === '__custom__' ? String(action.options.customAppId ?? '').trim() : action.options.app
					if (!appId) {
						self.log('warn', 'Launch App: no app selected')
						return
					}
					await self.lgtv.launchApp(appId)
					self.log('info', `Launched app ${appId}`)
					self.updateFeedbackState()
				}
			},
		}

		actions.setPictureMode = {
			name: 'Set Picture Mode',
			options: [
				{
					type: 'dropdown',
					id: 'mode',
					label: 'Mode',
					width: 3,
					required: true,
					default: Object.keys(pictureModes)[0],
					choices: toChoicesNoCustom(pictureModes),
				},
			],
			callback: async function (action) {
				if (self.lgtv) {
					await self.lgtv.setPictureMode(action.options.mode)
					self.log('info', `Picture mode set to ${action.options.mode}`)
					self.updateFeedbackState()
				}
			},
		}

		actions.setScreenMute = {
			name: 'Set Screen Mute',
			options: [
				{
					type: 'dropdown',
					id: 'mode',
					label: 'Mode',
					width: 3,
					required: true,
					default: Object.keys(screenMuteModes)[0],
					choices: toChoicesNoCustom(screenMuteModes),
				},
			],
			callback: async function (action) {
				if (self.lgtv) {
					await self.lgtv.setScreenMute(action.options.mode)
					self.log('info', `Screen mute set to ${action.options.mode}`)
					self.updateFeedbackState()
				}
			},
		}

		self.setActionDefinitions(actions)
	},
}
