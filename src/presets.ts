import {
	combineRgb,
	type CompanionButtonPresetDefinition,
	type CompanionPresetAction,
	type CompanionPresetDefinitions,
	type CompanionPresetFeedback,
} from '@companion-module/base'
import { Keys, PowerStates } from 'lgtv-ip-control'
import type { ModuleInstance } from './main.js'
import {
	appNames,
	energyLevelNames,
	inputToCurrentAppId,
	pictureModes,
	screenMuteModes,
	setInputChoices,
} from './lookups.js'

// Shared palette so every preset looks consistent.
const WHITE = combineRgb(255, 255, 255)
const BLACK = combineRgb(0, 0, 0)
const GREEN = combineRgb(0, 153, 0)

// Style applied (via a feedback) when a button represents the TV's current state.
const ACTIVE_STYLE = { color: WHITE, bgcolor: GREEN }

// Build a button preset with the shared base style so they are all uniform.
function makeButton(
	category: string,
	name: string,
	text: string,
	action: CompanionPresetAction,
	feedbacks: CompanionPresetFeedback[] = [],
): CompanionButtonPresetDefinition {
	return {
		type: 'button',
		category,
		name,
		style: {
			text,
			size: 'auto',
			color: WHITE,
			bgcolor: BLACK,
			show_topbar: false,
		},
		steps: [{ down: [action], up: [] }],
		feedbacks,
	}
}

export function UpdatePresets(self: ModuleInstance): void {
	const presets: CompanionPresetDefinitions = {}

	// --- Power ---
	presets['power_on'] = makeButton('Power', 'Power On', 'Power\nOn', { actionId: 'powerOn', options: {} }, [
		{ feedbackId: 'powerState', options: { state: PowerStates.on }, style: ACTIVE_STYLE },
	])
	presets['power_off'] = makeButton('Power', 'Power Off', 'Power\nOff', { actionId: 'powerOff', options: {} }, [
		{ feedbackId: 'powerState', options: { state: PowerStates.off }, style: ACTIVE_STYLE },
	])

	// --- Volume ---
	presets['volume_up'] = makeButton('Volume', 'Volume Up', 'Vol\n+', {
		actionId: 'sendKey',
		options: { key: Keys.volumeUp },
	})
	presets['volume_down'] = makeButton('Volume', 'Volume Down', 'Vol\n-', {
		actionId: 'sendKey',
		options: { key: Keys.volumeDown },
	})
	presets['mute'] = makeButton('Volume', 'Mute', 'Mute', { actionId: 'setVolumeMute', options: { mute: 'toggle' } }, [
		{ feedbackId: 'muteState', options: { muted: 'true' }, style: ACTIVE_STYLE },
	])

	// --- Navigation (remote keys) ---
	const navKeys: { name: string; text: string; key: Keys }[] = [
		{ name: 'Up', text: '▲', key: Keys.arrowUp },
		{ name: 'Down', text: '▼', key: Keys.arrowDown },
		{ name: 'Left', text: '◀', key: Keys.arrowLeft },
		{ name: 'Right', text: '▶', key: Keys.arrowRight },
		{ name: 'OK', text: 'OK', key: Keys.ok },
		{ name: 'Back', text: 'Back', key: Keys.back },
		{ name: 'Home', text: 'Home', key: Keys.home },
		{ name: 'Menu', text: 'Menu', key: Keys.menu },
	]
	for (const nav of navKeys) {
		presets[`nav_${nav.key}`] = makeButton('Navigation', nav.name, nav.text, {
			actionId: 'sendKey',
			options: { key: nav.key },
		})
	}

	// --- Inputs --- (highlight the active input where we can map it to current state)
	for (const input of setInputChoices) {
		const inputId = String(input.id)
		const currentAppId = inputToCurrentAppId[inputId]
		const feedbacks: CompanionPresetFeedback[] = currentAppId
			? [{ feedbackId: 'currentInput', options: { input: currentAppId, customInputId: '' }, style: ACTIVE_STYLE }]
			: []
		presets[`input_${inputId}`] = makeButton(
			'Inputs',
			input.label,
			input.label,
			{ actionId: 'setInput', options: { input: input.id } },
			feedbacks,
		)
	}

	// --- Apps --- (highlight the running app)
	for (const [appId, label] of Object.entries(appNames)) {
		presets[`app_${appId}`] = makeButton(
			'Apps',
			label,
			label,
			{ actionId: 'launchApp', options: { app: appId, customAppId: '' } },
			[{ feedbackId: 'currentApp', options: { app: appId, customAppId: '' }, style: ACTIVE_STYLE }],
		)
	}

	// --- Picture Mode --- (no current-mode state available, so no feedback)
	for (const [mode, label] of Object.entries(pictureModes)) {
		presets[`picture_${mode}`] = makeButton('Picture Mode', label, label, {
			actionId: 'setPictureMode',
			options: { mode },
		})
	}

	// --- Screen Mute --- (no state available, so no feedback)
	for (const [mode, label] of Object.entries(screenMuteModes)) {
		presets[`screen_${mode}`] = makeButton('Screen Mute', label, label, {
			actionId: 'setScreenMute',
			options: { mode },
		})
	}

	// --- Energy Saving ---
	for (const [level, label] of Object.entries(energyLevelNames)) {
		presets[`energy_${level}`] = makeButton('Energy Saving', label, label, {
			actionId: 'setEnergySaving',
			options: { level },
		})
	}

	self.setPresetDefinitions(presets)
}
