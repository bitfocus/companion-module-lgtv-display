const { Apps } = require('lgtv-ip-control')

// Friendly display names for the streaming apps in lgtv-ip-control's Apps enum,
// keyed by the app id getCurrentApp() reports. Used for both the "Current app"
// feedback dropdown and the current_app variable.
const appNames = {
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
const inputNames = {
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
const homeIds = new Set(['com.webos.app.home', 'com.webos.app.homeconnect'])

// Build { id, label } choice lists for dropdowns, with a custom-id escape hatch.
function toChoices(map, customLabel) {
	return [...Object.entries(map).map(([id, label]) => ({ id, label })), { id: '__custom__', label: customLabel }]
}

module.exports = { appNames, inputNames, homeIds, toChoices }
