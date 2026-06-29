import { Inputs, EnergySavingLevels, Keys, PictureModes, ScreenMuteModes } from 'lgtv-ip-control'
import type { ModuleInstance } from './main.js'
import {
	appNames,
	pictureModes,
	screenMuteModes,
	setInputChoices,
	toChoices,
	toChoicesNoCustom,
	CUSTOM_ID,
} from './lookups.js'

export function UpdateActions(self: ModuleInstance): void {
	self.setActionDefinitions({
		powerOn: {
			name: 'Power On',
			options: [],
			callback: async () => {
				const lgtv = self.lgtv
				if (lgtv) {
					lgtv.powerOn()
					self.log('debug', 'Power on: WoL sent')
					void self.updateFeedbackState()
				}
			},
		},

		powerOff: {
			name: 'Power Off',
			options: [],
			callback: async () => {
				const lgtv = self.lgtv
				if (lgtv) {
					await self.runExclusive(async () => {
						await lgtv.powerOff()
					})
					self.log('debug', 'Power off')
					void self.updateFeedbackState()
				}
			},
		},

		setVolumeMute: {
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
			callback: async (action) => {
				const lgtv = self.lgtv
				if (lgtv) {
					const isMuted = await self.runExclusive(async () => {
						let muted: boolean
						switch (action.options.mute) {
							case 'mute':
								muted = true
								break
							case 'unmute':
								muted = false
								break
							default:
								muted = !(await lgtv.getMuteState())
								break
						}
						await lgtv.setVolumeMute(muted)
						return muted
					})
					self.log('debug', isMuted ? 'Mute' : 'Unmute')
					void self.updateFeedbackState()
				}
			},
		},

		setInput: {
			name: 'Set Input',
			options: [
				{
					type: 'dropdown',
					id: 'input',
					label: 'Input',
					default: Inputs.dtv,
					choices: setInputChoices,
				},
			],
			callback: async (action) => {
				const lgtv = self.lgtv
				if (lgtv) {
					await self.runExclusive(async () => {
						await lgtv.setInput(action.options.input as Inputs)
					})
					self.log('debug', `Input set to ${String(action.options.input)}`)
					void self.updateFeedbackState()
				}
			},
		},

		setEnergySaving: {
			name: 'Set Energy Saving',
			options: [
				{
					type: 'dropdown',
					id: 'level',
					label: 'Level',
					default: self.available_energyLevels[0]?.id ?? '',
					choices: self.available_energyLevels,
				},
			],
			callback: async (action) => {
				const lgtv = self.lgtv
				if (lgtv) {
					const level = action.options.level as keyof typeof EnergySavingLevels
					await self.runExclusive(async () => {
						await lgtv.setEnergySaving(EnergySavingLevels[level])
					})
					self.log('debug', `Energy Saving set to ${String(action.options.level)}`)
					void self.updateFeedbackState()
				}
			},
		},

		sendKey: {
			name: 'Send Key',
			options: [
				{
					type: 'dropdown',
					id: 'key',
					label: 'Key',
					default: self.available_keys[0]?.id ?? '',
					choices: self.available_keys,
				},
			],
			callback: async (action) => {
				const lgtv = self.lgtv
				if (lgtv) {
					await self.runExclusive(async () => {
						await lgtv.sendKey(action.options.key as Keys)
					})
					self.log('debug', `Key ${String(action.options.key)} sent to TV`)
					void self.updateFeedbackState()
				}
			},
		},

		setVolume: {
			name: 'Set Volume',
			options: [
				{
					type: 'number',
					id: 'vol',
					label: 'Volume Level (0-100)',
					default: 0,
					min: 0,
					max: 100,
				},
			],
			callback: async (action) => {
				const lgtv = self.lgtv
				if (lgtv) {
					await self.runExclusive(async () => {
						await lgtv.setVolume(Number(action.options.vol))
					})
					self.log('debug', `Volume set to ${String(action.options.vol)}`)
					void self.updateFeedbackState()
				}
			},
		},

		launchApp: {
			name: 'Launch App',
			options: [
				{
					type: 'dropdown',
					id: 'app',
					label: 'App',
					default: appNames.netflix ? 'netflix' : Object.keys(appNames)[0],
					choices: toChoices(appNames, 'Custom App ID'),
				},
				{
					type: 'textinput',
					id: 'customAppId',
					label: 'Custom App ID',
					default: '',
					isVisibleExpression: `$(options:app) == '${CUSTOM_ID}'`,
				},
			],
			callback: async (action) => {
				const lgtv = self.lgtv
				if (lgtv) {
					const appId =
						action.options.app === CUSTOM_ID
							? String(action.options.customAppId ?? '').trim()
							: String(action.options.app)
					if (!appId) {
						self.log('warn', 'Launch App: no app selected')
						return
					}
					await self.runExclusive(async () => {
						await lgtv.launchApp(appId)
					})
					self.log('debug', `Launched app ${appId}`)
					void self.updateFeedbackState()
				}
			},
		},

		setPictureMode: {
			name: 'Set Picture Mode',
			options: [
				{
					type: 'dropdown',
					id: 'mode',
					label: 'Mode',
					default: Object.keys(pictureModes)[0],
					choices: toChoicesNoCustom(pictureModes),
				},
			],
			callback: async (action) => {
				const lgtv = self.lgtv
				if (lgtv) {
					await self.runExclusive(async () => {
						await lgtv.setPictureMode(action.options.mode as PictureModes)
					})
					self.log('debug', `Picture mode set to ${String(action.options.mode)}`)
					void self.updateFeedbackState()
				}
			},
		},

		setScreenMute: {
			name: 'Set Screen Mute',
			options: [
				{
					type: 'dropdown',
					id: 'mode',
					label: 'Mode',
					default: Object.keys(screenMuteModes)[0],
					choices: toChoicesNoCustom(screenMuteModes),
				},
			],
			callback: async (action) => {
				const lgtv = self.lgtv
				if (lgtv) {
					await self.runExclusive(async () => {
						await lgtv.setScreenMute(action.options.mode as ScreenMuteModes)
					})
					self.log('debug', `Screen mute set to ${String(action.options.mode)}`)
					void self.updateFeedbackState()
				}
			},
		},
	})
}
