const { Keys, Inputs, EnergySavingLevels } = require('lgtv-ip-control')
const { initActions } = require('./actions')

jest.mock('@companion-module/base', () => {
	const actual = jest.requireActual('@companion-module/base')
	return { ...actual, runEntrypoint: jest.fn() }
})
require('../index')
const { runEntrypoint, InstanceStatus } = require('@companion-module/base')
const Instance = runEntrypoint.mock.calls[0][0]

test('actions preserve TV command arguments and safely handle an unconfigured device', async () => {
	const self = {
		available_keys: Object.keys(Keys).map((key) => ({ id: key, label: key })),
		available_energyLevels: Object.keys(EnergySavingLevels).map((key) => ({ id: key, label: key })),
		setActionDefinitions: jest.fn(),
		log: jest.fn(),
	}
	initActions.call(self)
	const actions = self.setActionDefinitions.mock.calls[0][0]
	for (const action of Object.values(actions)) await action.callback({ options: {} })
	self.lgtv = Object.fromEntries(Object.keys(actions).map((key) => [key, jest.fn().mockResolvedValue(undefined)]))
	const level = Object.keys(EnergySavingLevels)[0]
	for (const [id, options, args] of [
		['powerOn', {}, []],
		['powerOff', {}, []],
		['setVolumeMute', { mute: false }, [false]],
		['setInput', { input: Inputs.hdmi1 }, [Inputs.hdmi1]],
		['setEnergySaving', { level }, [EnergySavingLevels[level]]],
		['sendKey', { key: Object.keys(Keys)[0] }, [Object.keys(Keys)[0]]],
		['setVolume', { vol: 42 }, [42]],
	]) {
		await actions[id].callback({ options })
		expect(self.lgtv[id]).toHaveBeenCalledWith(...args)
	}
})

test('configuration reload and destroy disconnect the previous device and preserve WOL defaults', async () => {
	const previous = { disconnect: jest.fn() }
	const self = {
		lgtv: previous,
		config: { wol_ip: 'invalid' },
		REGEX_IP: require('./config').REGEX_IP,
		updateStatus: jest.fn(),
		log: jest.fn(),
	}
	Instance.prototype.initConnection.call(self)
	expect(previous.disconnect).toHaveBeenCalledTimes(1)
	expect(self.DefaultSettings.networkWolAddress).toBe('255.255.255.255')
	expect(self.updateStatus).toHaveBeenLastCalledWith(InstanceStatus.BadConfig)
	self.config.wol_ip = '127.0.0.1'
	Instance.prototype.initConnection.call(self)
	expect(self.DefaultSettings.networkWolAddress).toBe('127.0.0.1')
	self.lgtv = previous
	await Instance.prototype.destroy.call(self)
	expect(previous.disconnect).toHaveBeenCalledTimes(2)
})

test('volume action encodes an encrypted LG command and decodes the device response', async () => {
	const { LGTV, DefaultSettings } = require('lgtv-ip-control')
	const tv = new LGTV('127.0.0.1', '00:11:22:33:44:55', '12345678')
	const peer = new LGTV('127.0.0.1', '00:11:22:33:44:55', '12345678', {
		...DefaultSettings,
		messageTerminator: '\n',
		responseTerminator: '\r',
	})
	tv.socket.sendReceive = jest.fn(async (packet) => {
		expect(peer.encoder.decode(packet)).toBe('VOLUME_CONTROL 42')
		return peer.encoder.encode('OK')
	})
	const self = { lgtv: tv, log: jest.fn(), setActionDefinitions: jest.fn() }
	initActions.call(self)
	try {
		await self.setActionDefinitions.mock.calls[0][0].setVolume.callback({ options: { vol: 42 } })
		expect(tv.socket.sendReceive).toHaveBeenCalledTimes(1)
	} finally {
		tv.disconnect()
		peer.disconnect()
	}
})
