const { Apps } = require('lgtv-ip-control')

// Reverse lookup so we can show a friendly app name (e.g. "netflix") instead of
// only the raw app id the TV reports.
const appIdToName = Object.fromEntries(Object.entries(Apps).map(([name, id]) => [id, name]))

module.exports = {
	initVariables: function () {
		let self = this

		const variables = [
			{ variableId: 'power_state', name: 'Power state (on/off/unknown)' },
			{ variableId: 'muted', name: 'Mute state (true/false)' },
			{ variableId: 'volume', name: 'Current volume (0-100)' },
			{ variableId: 'ip_control_enabled', name: 'IP control enabled (true/false)' },
			{ variableId: 'current_app', name: 'Current app (friendly name)' },
			{ variableId: 'current_app_id', name: 'Current app (raw id)' },
		]

		self.setVariableDefinitions(variables)
		self.checkVariables()
	},

	checkVariables: function () {
		let self = this

		// Mirrors self.feedbackState, which the feedback poll keeps up to date.
		const state = self.feedbackState || {}
		const appId = state.currentApp || ''

		self.setVariableValues({
			power_state: state.powerState ?? 'unknown',
			muted: state.isMuted ?? false,
			volume: typeof state.currentVolume === 'number' ? state.currentVolume : '',
			ip_control_enabled: state.ipControlEnabled ?? false,
			current_app: appId ? (appIdToName[appId] ?? appId) : '',
			current_app_id: appId,
		})
	},
}
