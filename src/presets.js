const { combineRgb } = require('@companion-module/base')

module.exports = {
	initPresets: function () {
		let self = this;
		let presets = {
			'powerOn': {
				category: 'Basics',
				name: 'Power on',
				type: 'button',
				style: {
					style: 'text',
					text: `Power On`,
					size: '14',
					color: combineRgb(255, 255, 255),
					bgcolor: combineRgb(0, 0, 0),
				},
				steps: [
					{
						down: [
							{ actionId: 'powerOn', options: [] }
						],
						up: []
					}
				]
			},
			'powerOff': {
				category: 'Basics',
				name: 'Power off',
				type: 'button',
				style: {
					style: 'text',
					text: `Power Off`,
					size: '14',
					color: combineRgb(255, 255, 255),
					bgcolor: combineRgb(0, 0, 0),
				},
				steps: [
					{
						down: [
							{ actionId: 'powerOff', options: [] }
						],
						up: []
					}
				]
			},
			'mute': {
				category: 'Basics',
				name: 'Mute',
				type: 'button',
				style: {
					style: 'text',
					text: `Volume Mute`,
					size: '14',
					color: combineRgb(255, 255, 255),
					bgcolor: combineRgb(0, 0, 0),
					latch: true,
				},
				steps: [
					{
						down: [
							{ actionId: 'setVolumeMute', options: { "mute": true }}
						],
						up: [
							{ actionId: 'setVolumeMute', options: { "mute": false }}
						]
					}
				]
			},
			'screenOff': {
				category: 'Basics',
				name: 'Blank Screen',
				type: 'button',
				style: {
					style: 'text',
					text: `Blank Screen`,
					size: '14',
					color: combineRgb(255, 255, 255),
					bgcolor: combineRgb(0, 0, 0),
					latch: true,
				},
				steps: [
					{
						down: [
							{ actionId: 'setEnergySaving', options: { 'level': 'screenOff'} }
						],
						up: []
					}
				]
			}
		}

		self.inputNames.forEach(input => {
			presets[input.id] = {
				category: 'Basics',
				name: input.label,
				type: 'button',
				style: {
					style: 'text',
					text: input.label,
					size: '14',
					color: combineRgb(255, 255, 255),
					bgcolor: combineRgb(0, 0, 0),
				},
				steps: [
					{
						down: [
							{ actionId: 'setInput', options: {'input': input.id} }
						]
					}
				]
			}
		})

		const foregroundColor = combineRgb(255, 255, 255) // White
		const foregroundColorBlack = combineRgb(0, 0, 0) // Black
		const backgroundColorRed = combineRgb(255, 0, 0) // Red
		const backgroundColorGreen = combineRgb(0, 255, 0) // Green
		const backgroundColorOrange = combineRgb(255, 102, 0) // Orange

		self.setPresetDefinitions(presets);
	}
}	