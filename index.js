const instance_skel = require('../../instance_skel')
const LGTV = require('lgtv-ip-control')

class instance extends instance_skel {
	/**
	 * Create an instance of the module
	 *
	 * @param {EventEmitter} system - the brains of the operation
	 * @param {string} id - the instance ID
	 * @param {Object} config - saved user configuration parameters
	 * @since 1.0.0
	 */
	constructor(system, id, config) {
		super(system, id, config)
		this.actions() // export actions
		this.init_presets() // export presets
	}

	updateConfig(config) {
		this.init_presets()

		if (this.lgtv !== undefined) {
			this.lgtv.destroy()
			delete this.lgtv
		}

		this.config = config

		this.init_connection()
	}

	init() {
		this.init_presets()
		this.init_connection()
	}

	init_connection() {
		if (this.lgtv !== undefined) {
			this.lgtv.destroy()
			delete this.lgtv
		}

		this.status(this.STATE_WARNING, 'Connecting')

		if (this.config.host && this.config.mac && this.config.code) {
			this.lgtv = new LGTV(this.config.host, this.config.mac, this.config.code)
			this.lgtv
				.connect()
				.then(async () => {
					console.log('connected')
					this.status(this.STATUS_OK)
				})
				.catch(console.error)
		}
	}

	// Return config fields for web config
	config_fields() {
		return [
			{
				type: 'text',
				id: 'info',
				label: 'Information',
				width: 12,
				value: `
				<div class="alert alert-danger">
					<h3>IMPORTANT MESSAGE</h3>
					<div>
						<strong>Before anything, you need to enable Network IP Control, which is very easy:</strong>
						<br>
						<ol>
							<li>Open the "All Settings" menu on the TV</li>
							<li>Using the remote arrows, navigate to "Connection". For some TVs, this may say "Network" instead.</li>
							<li>Quickly, press 82888 using the remote numeric buttons</li>
							<li>Note the MAC IP addresses for reference and library configuration</li>
							<li>Turn "Network IP Control" on</li>
							<li>Click "Generate Keycode", and take note of the 8 characters code displayed on the message for reference and library configuration. You can generate a new code at any time</li>
							<li>If you want to be able to turn the TV on, turn "Wake On LAN" on</li>
						</ol>
					</div>
				</div>
			`,
			},
			{
				type: 'textinput',
				id: 'host',
				label: 'Target IP',
				width: 6,
				regex: this.REGEX_IP,
			},
			{
				type: 'textinput',
				id: 'mac',
				label: 'MAC ADDRESS',
				width: 6,
				regex: this.REGEX_SOMETHING,
			},
			{
				type: 'textinput',
				id: 'code',
				label: 'Keycode',
				width: 6,
				regex: this.REGEX_SOMETHING,
			},
		]
	}

	// When module gets deleted
	destroy() {
		this.lgtv.disconnect()
		this.lgtv.destroy()

		this.debug('destroy', this.id)
	}

	init_presets() {
		let presets = []
		presets.push({
			category: 'Basics',
			label: 'Power on',
			bank: {
				style: 'text',
				text: `Power On`,
				size: '14',
				color: this.rgb(255, 255, 255),
				bgcolor: this.rgb(0, 0, 0),
			},
			actions: [{ action: 'powerOn', options: [] }],
			feedbacks: [],
		})
		presets.push({
			category: 'Basics',
			label: 'Power off',
			bank: {
				style: 'text',
				text: `Power Off`,
				size: '14',
				color: this.rgb(255, 255, 255),
				bgcolor: this.rgb(0, 0, 0),
			},
			actions: [{ action: 'powerOff', options: [] }],
			feedbacks: [],
		})
		this.setPresetDefinitions(presets)
	}

	actions(system) {
		this.setActions({
			powerOn: {
				label: 'Power On Display',
				options: [],
			},
			powerOff: {
				label: 'Power Off Display',
				options: [],
			},
		})
	}

	async action(action) {
		if (this.lgtv) {
			switch (action.action) {
				case 'powerOn':
					this.lgtv.powerOn()
					break
				case 'powerOff':
					await this.lgtv.powerOff()
					break
			}
		}
	}
}
exports = module.exports = instance
