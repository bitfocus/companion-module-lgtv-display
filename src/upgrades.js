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

		return result
	},
]
