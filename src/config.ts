import { Regex, type SomeCompanionConfigField } from '@companion-module/base'

export interface ModuleConfig {
	host: string
	mac: string
	code: string
	wol_ip: string
	poll_interval: number
}

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'static-text',
			id: 'info',
			label: 'Setup Instructions',
			width: 12,
			value: [
				'1. Open the **All Settings** menu on the TV.',
				'2. Using the remote arrows, navigate the focus to **Connection** but do not enter it. For some TVs, this may say **Network** instead.',
				'3. Quickly, press **82888** using the remote numeric buttons.',
				'4. Note the **MAC** and **IP** addresses for client configuration. The MAC address is required to remotely power on the TV.',
				'5. Select and enable **Network IP Control**.',
				'6. For TVs that require encryption, there is a **Generate Keycode** option. Click it and note the 8 character code displayed for client configuration. This keycode is required for all commands except power on. A new keycode can be generated at any time.',
				'7. To allow the TV to be powered on remotely, enable **Wake On LAN**.',
			].join('\n'),
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
			regex: Regex.MAC_ADDRESS,
		},
		{
			type: 'textinput',
			id: 'code',
			label: 'Keycode',
			width: 6,
			regex: Regex.SOMETHING,
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
			label: 'Feedback poll interval (ms, 0 to disable, min 250)',
			width: 6,
			default: 2000,
			min: 0,
			max: 60000,
		},
	]
}
