import { combineRgb } from '@companion-module/base'
import { Apps, PowerStates } from 'lgtv-ip-control'
import type { ModuleInstance } from './main.js'
import { appNames, inputNames, toChoices, CUSTOM_ID } from './lookups.js'

export function UpdateFeedbacks(self: ModuleInstance): void {
	self.setFeedbackDefinitions({
		powerState: {
			type: 'boolean',
			name: 'Power State',
			description: 'True when the TV Power State matches the selected state',
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
			callback: (feedback) => {
				return self.feedbackState.powerState === feedback.options.state
			},
		},

		muteState: {
			type: 'boolean',
			name: 'Mute State',
			description: 'True when Mute State matches the selected state',
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
			callback: (feedback) => {
				return String(self.feedbackState.isMuted) === feedback.options.muted
			},
		},

		ipControl: {
			type: 'boolean',
			name: 'IP Control Enabled',
			description: 'True when IP Control is enabled',
			defaultStyle: {
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 153, 0),
			},
			options: [],
			callback: () => {
				return self.feedbackState.ipControlEnabled === true
			},
		},

		currentVolume: {
			type: 'boolean',
			name: 'Volume Comparison',
			description: 'Compares the current volume against the selected value',
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
				},
			],
			callback: (feedback) => {
				const currentVolume = self.feedbackState.currentVolume
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
		},

		currentApp: {
			type: 'boolean',
			name: 'Current App',
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
			callback: (feedback) => {
				const currentApp = self.feedbackState.currentApp.trim()
				const selectedApp =
					feedback.options.app === CUSTOM_ID
						? String(feedback.options.customAppId ?? '').trim()
						: String(feedback.options.app ?? '').trim()

				if (!selectedApp || !currentApp) {
					return false
				}

				return currentApp === selectedApp
			},
		},

		currentInput: {
			type: 'boolean',
			name: 'Current Input',
			description: 'True when the current physical input matches the selected input',
			defaultStyle: {
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 153, 0),
			},
			options: [
				{
					type: 'dropdown',
					id: 'input',
					label: 'Input',
					default: 'com.webos.app.hdmi1',
					choices: toChoices(inputNames, 'Custom Input ID'),
				},
				{
					type: 'textinput',
					id: 'customInputId',
					label: 'Custom Input ID',
					default: '',
					isVisibleExpression: `$(options:input) == '${CUSTOM_ID}'`,
				},
			],
			callback: (feedback) => {
				const currentApp = self.feedbackState.currentApp.trim()
				const selectedInput =
					feedback.options.input === CUSTOM_ID
						? String(feedback.options.customInputId ?? '').trim()
						: String(feedback.options.input ?? '').trim()

				if (!selectedInput || !currentApp) {
					return false
				}

				return currentApp === selectedInput
			},
		},

		signalPresent: {
			type: 'boolean',
			name: 'Signal Present',
			description: 'True when the current input is receiving a signal (physical inputs only)',
			defaultStyle: {
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 153, 0),
			},
			options: [],
			callback: () => {
				return self.feedbackState.signal === true
			},
		},
	})
}
