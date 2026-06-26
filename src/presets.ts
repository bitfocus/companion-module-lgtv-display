import { combineRgb, type CompanionPresetDefinitions } from '@companion-module/base'
import type { ModuleInstance } from './main.js'
import { setInputChoices } from './lookups.js'

export function UpdatePresets(self: ModuleInstance): void {
	const presets: CompanionPresetDefinitions = {
		powerOn: {
			category: 'Basics',
			name: 'Power on',
			type: 'button',
			style: {
				text: `Power On`,
				size: '14',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 0, 0),
			},
			feedbacks: [],
			steps: [
				{
					down: [{ actionId: 'powerOn', options: {} }],
					up: [],
				},
			],
		},
		powerOff: {
			category: 'Basics',
			name: 'Power off',
			type: 'button',
			style: {
				text: `Power Off`,
				size: '14',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 0, 0),
			},
			feedbacks: [],
			steps: [
				{
					down: [{ actionId: 'powerOff', options: {} }],
					up: [],
				},
			],
		},
		mute: {
			category: 'Basics',
			name: 'Mute',
			type: 'button',
			style: {
				text: `Volume Mute`,
				size: '14',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 0, 0),
			},
			feedbacks: [],
			steps: [
				{
					down: [{ actionId: 'setVolumeMute', options: { mute: 'toggle' } }],
					up: [],
				},
			],
		},
		screenOff: {
			category: 'Basics',
			name: 'Blank Screen',
			type: 'button',
			style: {
				text: `Blank Screen`,
				size: '14',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 0, 0),
			},
			feedbacks: [],
			steps: [
				{
					down: [{ actionId: 'setEnergySaving', options: { level: 'screenOff' } }],
					up: [],
				},
			],
		},
	}

	for (const input of setInputChoices) {
		presets[String(input.id)] = {
			category: 'Basics',
			name: input.label,
			type: 'button',
			style: {
				text: input.label,
				size: '14',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 0, 0),
			},
			feedbacks: [],
			steps: [
				{
					down: [{ actionId: 'setInput', options: { input: input.id } }],
					up: [],
				},
			],
		}
	}

	self.setPresetDefinitions(presets)
}
