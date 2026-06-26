const { Keys } = require('lgtv-ip-control')

module.exports = [
	function (context, props) {
		// This is a placeholder than now cannot be used/removed
		return {
			updatedConfig: null,
			updatedActions: [],
			updatedFeedbacks: [],
		}
	},
	function (context, props) {
		const result = {
			updatedConfig: null,
			updatedActions: [],
			updatedFeedbacks: [],
		}

		// The feedback polling feature added a "poll_interval" config field. Existing
		// instances have no value for it, so seed the same default the config field uses.
		if (props.config && props.config.poll_interval === undefined) {
			props.config.poll_interval = 2000
			result.updatedConfig = props.config
		}

		// Legacy "Send Key" actions stored the Keys property name (e.g. "volumeUp")
		// as the option value. The dropdown now uses the actual lgtv-ip-control value
		// (e.g. "volumeup"), so convert any old values to their proper value.
		for (const action of props.actions) {
			if (action.actionId !== 'sendKey') {
				continue
			}

			const requestedKey = action.options.key
			if (requestedKey !== undefined && Keys[requestedKey] !== undefined) {
				action.options.key = Keys[requestedKey]
				result.updatedActions.push(action)
			}
		}

		// The "Volume Mute" action used to be a checkbox storing a boolean. It is now
		// a dropdown with "toggle"/"mute"/"unmute", so convert old boolean values.
		for (const action of props.actions) {
			if (action.actionId !== 'setVolumeMute') {
				continue
			}

			if (action.options.mute === true) {
				action.options.mute = 'mute'
				result.updatedActions.push(action)
			} else if (action.options.mute === false) {
				action.options.mute = 'unmute'
				result.updatedActions.push(action)
			}
		}

		return result
	},
]
