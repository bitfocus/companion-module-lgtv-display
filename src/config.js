const { Regex } = require('@companion-module/base')

module.exports = {
	getConfigFields() {
		return [
			{
				type: 'static-text',
				id: 'info',
				label: 'Setup Instructions',
				width: 12,
				value: `
      - Open the "All Settings" menu on the TV.
			- Using the remote arrows, navigate the focus to "Connection" but do not enter it. For some TVs, this may say "Network" instead.
			- Quickly, press 82888 using the remote numeric buttons.
			- Note the MAC and IP addresses for client configuration. The MAC address is required to remotely power on the TV.
			- Select and enable "Network IP Control".
			- For TVs that require encryption, there is a "Generate Keycode" option. Click it and note the 8 characters code displayed for client configuration. This keycode is required for all commands except power on. A new keycode can be generated at any time.
			- To allow the TV to be powered on remotely, enable "Wake On LAN".
        `,
			},
			{
				type: 'textinput',
				id: 'host',
				label: 'Target IP',
				width: 6,
				regex: Regex.IP, // Regex for IP validation
			},
			{
				type: 'textinput',
				id: 'mac',
				label: 'MAC Address',
				width: 6,
				regex: Regex.MAC_ADDRESS, // Regex for general validation
			},
			{
				type: 'textinput',
				id: 'code',
				label: 'Keycode',
				width: 6,
				regex: Regex.SOMETHING, // Regex for general validation
			},
			{
				type: 'textinput',
				id: 'wol_ip',
				label: 'Wake-On-LAN IP',
				width: 6,
				default: '255.255.255.255',
				regex: Regex.IP, // Regex for IP validation
			},
			{
				type: 'number',
				id: 'poll_interval',
				label: 'Feedback poll interval (ms, 0 to disable)',
				width: 6,
				default: 2000,
				min: 0,
				max: 60000,
			},
		]
	},
}
