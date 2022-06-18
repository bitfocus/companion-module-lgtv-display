const instance_skel = require('../../instance_skel')
const { LGTV, Inputs, EnergySavingLevels, Keys } = require('lgtv-ip-control')

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

		// initialize enums to read from module
		this.available_keys = []
		this.available_energyLevels = []

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
		this.init_lgtv()
	}

	init_lgtv() {
		// read all available keys from module
		this.available_keys = []
		Object.keys(Keys).forEach(key => {
			this.available_keys.push( {id: key, label: key} )
		})
		
		// read all available energy saving levels from module
		this.available_energyLevels = []
		Object.keys(EnergySavingLevels).forEach(key => {
			this.available_energyLevels.push( {id: key, label: key} )
		})
		
		this.actions() // rebuild action options
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

		presets.push({
			category: 'Basics',
			label: 'Mute',
			bank: {
				style: 'text',
				text: `Volume Mute`,
				size: '14',
				color: this.rgb(255, 255, 255),
				bgcolor: this.rgb(0, 0, 0),
				latch: true,
			},
			actions: [{ action: 'setVolumeMute', options: { "mute": true }}],
			release_actions: [{ action: 'setVolumeMute', options: { "mute": false }}],
			feedbacks: [],
		})

		presets.push({
			category: 'Basics',
			label: 'HDMI 1',
			bank: {
				style: 'text',
				text: `HDMI 1`,
				size: '14',
				color: this.rgb(255, 255, 255),
				bgcolor: this.rgb(0, 0, 0),
			},
			actions: [{ action: 'setInput', options: {'input': Inputs.hdmi1} }],
		})

		presets.push({
			category: 'Basics',
			label: 'HDMI 2',
			bank: {
				style: 'text',
				text: `HDMI 2`,
				size: '14',
				color: this.rgb(255, 255, 255),
				bgcolor: this.rgb(0, 0, 0),
			},
			actions: [{ action: 'setInput', options: {'input': Inputs.hdmi2} }],
		})

		presets.push({
			category: 'Basics',
			label: 'Blank Screen',
			bank: {
				style: 'text',
				text: `Blank Screen`,
				size: '14',
				color: this.rgb(255, 255, 255),
				bgcolor: this.rgb(0, 0, 0),
				latch: true,
			},
			actions: [{ action: 'setEnergySaving', options: { 'level': 'screenOff'} }],
			release_actions: [{ action: 'setEnergySaving', options: { 'level': 'off' }}],
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
			setInput: {
				label: 'Set Input',
				options: [
					{
						type: 'dropdown',
						id: 'input',
						label: 'Input:',
						width: 3,
						required: true,
						choices: [
							{ id: 'dtv'      , label: 'Digital TV' },
							{ id: 'atv'      , label: 'Analog TV' },
							{ id: 'cadtv'    , label: 'Cable Digital TV' },
							{ id: 'catv'     , label: 'Cable TV' },
							{ id: 'av'       , label: 'AV Composite' },
							{ id: 'component', label: 'Component' },
							{ id: 'hdmi1'    , label: 'HDMI 1' },
							{ id: 'hdmi2'    , label: 'HDMI 2' },
							{ id: 'hdmi3'    , label: 'HDMI 3' },
							{ id: 'hdmi4'    , label: 'HDMI 4' }
						  ]
					},
				],
			},
			sendKey: {
				label: 'Send Key',
				options: [
					{
						type: 'dropdown',
						id: 'key',
						label: 'Key:',
						width: 3,
						required: true,
						choices: this.available_keys
					},
				],
			},
			setVolume: {
				label: 'Set Volume',
				options: [
					{
						type: 'number',
						id: 'vol',
						label: 'Volume Level (0-100):',
						width: 3,
						required: true
					},
				],
			},
			setVolumeMute: {
				label: 'Volume Mute',
				options: [
					{
						type: 'checkbox',
						label: 'Mute:',
						id: 'mute',
						default: true
					},
				],
			},
			setEnergySaving: {
				label: 'Set Energy Saving',
				options: [
					{
						type: 'dropdown',
						id: 'level',
						label: 'Level:',
						width: 3,
						required: true,
						choices: this.available_energyLevels
					},
				],
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
				case 'setInput':
					await this.lgtv.setInput(eval('Inputs.' + action.options.input))
					break
				case 'sendKey':
					await this.lgtv.sendKey(eval('Keys.' + action.options.key))
					break
				case 'setVolume':
					await this.lgtv.setVolume(action.options.vol)
					break
				case 'setVolumeMute':
					await this.lgtv.setVolumeMute(action.options.mute)
					break
				case 'setEnergySaving':
					await this.lgtv.setEnergySaving(eval('EnergySavingLevels.' + action.options.level))
					break
			}
		}
	}
}
exports = module.exports = instance
