import type { DropdownChoice } from '@companion-module/base'
import { Apps, Inputs, PictureModes, ScreenMuteModes } from 'lgtv-ip-control'

// Sentinel option id used by dropdowns that allow a free-form custom value.
export const CUSTOM_ID = '__custom__'

// Friendly display names for the streaming apps in lgtv-ip-control's Apps enum,
// keyed by the app id getCurrentApp() reports. Used for both the "Current app"
// feedback dropdown and the current_app variable.
export const appNames: Record<string, string> = {
	[Apps.amazon]: 'Amazon Prime Video',
	[Apps.googlePlay]: 'Google Play Movies',
	[Apps.hulu]: 'Hulu',
	[Apps.netflix]: 'Netflix',
	[Apps.slingTV]: 'Sling TV',
	[Apps.youtube]: 'YouTube',
	[Apps.vudu]: 'Vudu',
	[Apps.settings]: 'Settings',
	[Apps.photos]: 'Photos',
	[Apps.music]: 'Music',
	[Apps.guide]: 'TV Guide',
	[Apps.browser]: 'Web Browser',
	[Apps.gallery]: 'Gallery',
	[Apps.plex]: 'Plex',
	[Apps.disney]: 'Disney+',
	[Apps.hbomax]: 'HBO Max',
}

// Physical inputs as reported by getCurrentApp(). Note this is a different id
// space from the Inputs enum used by the "Set Input" action: setInput uses e.g.
// "hdmi1", while getCurrentApp reports "com.webos.app.hdmi1".
export const inputNames: Record<string, string> = {
	'com.webos.app.hdmi1': 'HDMI 1',
	'com.webos.app.hdmi2': 'HDMI 2',
	'com.webos.app.hdmi3': 'HDMI 3',
	'com.webos.app.hdmi4': 'HDMI 4',
	'com.webos.app.livetv': 'Live TV',
	'com.webos.app.externalinput.av1': 'AV 1',
	'com.webos.app.externalinput.av2': 'AV 2',
	'com.webos.app.externalinput.component': 'Component',
	'com.webos.app.externalinput.scart': 'SCART',
}

// The webOS launcher/home screen reports these (or nothing at all) rather than a
// specific app, so we show a friendly "webOS" label there.
export const homeIds = new Set<string>(['com.webos.app.home', 'com.webos.app.homeconnect'])

// Friendly labels for the Set Picture Mode action. Keyed by the enum VALUE because
// setPictureMode asserts the value is in Object.values(PictureModes).
export const pictureModes: Record<string, string> = {
	[PictureModes.cinema]: 'Cinema',
	[PictureModes.eco]: 'Eco',
	[PictureModes.filmMaker]: 'Filmmaker',
	[PictureModes.game]: 'Game',
	[PictureModes.normal]: 'Normal',
	[PictureModes.sports]: 'Sports',
	[PictureModes.vivid]: 'Vivid',
}

// Friendly labels for the Set Screen Mute action. Keyed by the enum VALUE because
// setScreenMute asserts the value is in Object.values(ScreenMuteModes).
export const screenMuteModes: Record<string, string> = {
	[ScreenMuteModes.screenMuteOn]: 'Screen Mute (blank, keep audio)',
	[ScreenMuteModes.videoMuteOn]: 'Video Mute',
	[ScreenMuteModes.allMuteOff]: 'Unmute',
}

// Choices for the "Set Input" action / presets. This uses the Inputs enum values
// (e.g. "hdmi1", "avav1") sent to setInput — distinct from the getCurrentApp id
// space in `inputNames` above.
export const setInputChoices: DropdownChoice[] = [
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
]

// Build { id, label } choice lists for dropdowns, with a custom-id escape hatch.
export function toChoices(map: Record<string, string>, customLabel: string): DropdownChoice[] {
	return [...Object.entries(map).map(([id, label]) => ({ id, label })), { id: CUSTOM_ID, label: customLabel }]
}

// Same, but for fixed enums where a custom id makes no sense.
export function toChoicesNoCustom(map: Record<string, string>): DropdownChoice[] {
	return Object.entries(map).map(([id, label]) => ({ id, label }))
}
