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
				'2. Find the IP control settings — where they live depends on the TV:',
				'   - **Newer TVs (webOS 6+):** **Support** > **IP Control Settings** (on some models under **General** > **Devices**, or **Support** > **Additional Settings**).',
				'   - **Older TVs (2018-2021):** move the focus onto **Connection** (**Network** on some models) without entering it, then quickly press **82888** on the remote number pad to reveal the hidden menu.',
				'3. Note the **MAC** and **IP** addresses for client configuration. The MAC address is required to remotely power on the TV.',
				'4. Enable **Network IP Control**.',
				'5. For TVs that require encryption, there is a **Generate Keycode** option. Click it and note the 8 character code displayed for client configuration. This keycode is required for all commands except power on. A new keycode can be generated at any time.',
				'6. To allow the TV to be powered on remotely, enable **Wake On LAN** (on newer TVs this may be in the same IP Control screen, or under **General** > **Devices** > **TV Management** > **Mobile TV On**).',
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
			tooltip:
				"Broadcast address the magic packet is sent to. Prefer the TV subnet's directed broadcast (e.g. 192.168.1.255); 255.255.255.255 only reaches whichever interface the OS picks, which often isn't the TV's.",
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
