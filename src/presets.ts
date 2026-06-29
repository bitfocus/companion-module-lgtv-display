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
const RED = combineRgb(153, 0, 0)

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

// Build a non-interactive button that just displays a label plus a variable value.
function makeStatus(label: string, title: string, variableId: string): CompanionButtonPresetDefinition {
	return {
		type: 'button',
		category: 'Status',
		name: title,
		style: {
			text: `${label}\n$(${variableId})`,
			size: 'auto',
			color: WHITE,
			bgcolor: BLACK,
			show_topbar: false,
		},
		steps: [],
		feedbacks: [],
	}
}

export function UpdatePresets(self: ModuleInstance): void {
	const presets: CompanionPresetDefinitions = {}

	// The connection label prefixes references to this module's own variables.
	const v = (id: string): string => `${self.label}:${id}`

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
	// Default state is unmuted (green); the muteState feedback flips it to red "Muted".
	presets['mute'] = {
		type: 'button',
		category: 'Volume',
		name: 'Mute',
		style: {
			text: 'Unmuted',
			size: 'auto',
			color: WHITE,
			bgcolor: GREEN,
			show_topbar: false,
		},
		steps: [{ down: [{ actionId: 'setVolumeMute', options: { mute: 'toggle' } }], up: [] }],
		feedbacks: [
			{ feedbackId: 'muteState', options: { muted: 'true' }, style: { text: 'Muted', color: WHITE, bgcolor: RED } },
		],
	}

	// --- Navigation (remote keys) ---
	const navKeys: { name: string; text: string; key: Keys }[] = [
		{ name: 'Up', text: 'Up', key: Keys.arrowUp },
		{ name: 'Down', text: 'Down', key: Keys.arrowDown },
		{ name: 'Left', text: 'Left', key: Keys.arrowLeft },
		{ name: 'Right', text: 'Right', key: Keys.arrowRight },
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

	// --- Status --- (read-only displays of the polled variables)
	presets['status_power'] = makeStatus('Power', 'Power State', v('power_state'))
	presets['status_volume'] = makeStatus('Volume', 'Volume', v('volume'))
	presets['status_muted'] = makeStatus('Muted', 'Mute State', v('muted'))
	presets['status_ip_control'] = makeStatus('IP Ctrl', 'IP Control Enabled', v('ip_control_enabled'))
	presets['status_current_app'] = makeStatus('App', 'Current App', v('current_app'))
	presets['status_current_input'] = makeStatus('Input', 'Current Input', v('current_input'))
	presets['status_current_app_id'] = makeStatus('App ID', 'Current App/Input ID', v('current_app_id'))
	presets['status_signal'] = makeStatus('Signal', 'Input Signal', v('signal'))
	presets['status_hdcp_version'] = makeStatus('HDCP Ver', 'HDCP Version', v('hdcp_version'))
	presets['status_hdcp_status'] = makeStatus('HDCP', 'HDCP Status', v('hdcp_status'))

	self.setPresetDefinitions(presets)
}
