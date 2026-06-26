import type {
	CompanionUpgradeContext,
	CompanionStaticUpgradeProps,
	CompanionStaticUpgradeResult,
	CompanionStaticUpgradeScript,
} from '@companion-module/base'
import { Keys } from 'lgtv-ip-control'
import type { ModuleConfig } from './config.js'

export const UpgradeScripts: CompanionStaticUpgradeScript<ModuleConfig>[] = [
	function (
		_context: CompanionUpgradeContext<ModuleConfig>,
		_props: CompanionStaticUpgradeProps<ModuleConfig>,
	): CompanionStaticUpgradeResult<ModuleConfig> {
		// This is a placeholder that now cannot be used/removed
		return {
			updatedConfig: null,
			updatedActions: [],
			updatedFeedbacks: [],
		}
	},
	function (
		_context: CompanionUpgradeContext<ModuleConfig>,
		props: CompanionStaticUpgradeProps<ModuleConfig>,
	): CompanionStaticUpgradeResult<ModuleConfig> {
		const result: CompanionStaticUpgradeResult<ModuleConfig> = {
			updatedConfig: null,
			updatedActions: [],
			updatedFeedbacks: [],
		}

		// The feedback polling feature added a "poll_interval" config field. Existing
		// instances have no value for it, so seed the same default the config field uses.
		const config = props.config as (ModuleConfig & Record<string, unknown>) | null
		if (config && config.poll_interval === undefined) {
			config.poll_interval = 2000
			result.updatedConfig = config
		}

		// Legacy "Send Key" actions stored the Keys property name (e.g. "volumeUp")
		// as the option value. The dropdown now uses the actual lgtv-ip-control value
		// (e.g. "volumeup"), so convert any old values to their proper value.
		for (const action of props.actions) {
			if (action.actionId !== 'sendKey') {
				continue
			}

			const requestedKey = action.options.key
			if (typeof requestedKey === 'string' && requestedKey in Keys) {
				action.options.key = Keys[requestedKey as keyof typeof Keys]
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
