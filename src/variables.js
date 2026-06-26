const { appNames, inputNames, homeIds } = require('./lookups')

module.exports = {
	initVariables: function () {
		let self = this

		const variables = [
			{ variableId: 'power_state', name: 'Power state (on/off/unknown)' },
			{ variableId: 'muted', name: 'Mute state (true/false)' },
			{ variableId: 'volume', name: 'Current volume (0-100)' },
			{ variableId: 'ip_control_enabled', name: 'IP control enabled (true/false)' },
			{ variableId: 'current_app', name: 'Current app (friendly name)' },
			{ variableId: 'current_input', name: 'Current input (friendly name)' },
			{ variableId: 'current_app_id', name: 'Current app/input (raw id)' },
			{ variableId: 'signal', name: 'Input signal present (true/false)' },
			{ variableId: 'hdcp_version', name: 'HDCP version' },
			{ variableId: 'hdcp_status', name: 'HDCP status' },
		]

		self.setVariableDefinitions(variables)
		self.checkVariables()
	},

	checkVariables: function () {
		let self = this

		// Mirrors self.feedbackState, which the feedback poll keeps up to date.
		const state = self.feedbackState || {}
		const appId = state.currentApp || ''
		const inputName = inputNames[appId]

		// On a physical input current_app is blank (current_input holds it). Otherwise
		// show the friendly app name; on the home screen / no app, default to "webOS"
		// when the TV is on, but stay blank when it's off or disconnected.
		let currentApp
		if (inputName) {
			currentApp = ''
		} else if (appId && !homeIds.has(appId)) {
			currentApp = appNames[appId] ?? appId
		} else {
			currentApp = state.powerState === 'on' ? 'webOS' : ''
		}

		self.setVariableValues({
			power_state: state.powerState ?? 'unknown',
			muted: state.isMuted ?? false,
			volume: typeof state.currentVolume === 'number' ? state.currentVolume : '',
			ip_control_enabled: state.ipControlEnabled ?? false,
			current_app: currentApp,
			current_input: inputName ?? '',
			current_app_id: appId,
			// signal is only reported on physical inputs (undefined elsewhere).
			signal: typeof state.signal === 'boolean' ? state.signal : '',
			hdcp_version: state.hdcpVersion ?? '',
			hdcp_status: state.hdcpStatus ?? '',
		})
	},
}
