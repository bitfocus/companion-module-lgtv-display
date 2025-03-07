const { Inputs, EnergySavingLevels } = require('lgtv-ip-control');

module.exports = {
    initActions: function () {
        let self = this;
        let actions = {};

        actions.powerOn = {
            name: 'Power On Display',
            options: [],
            callback: async function (action) {
                if (self.lgtv) {
                    self.lgtv.powerOn();
                    self.log('info', 'Power on');
                }
            }
        };

        actions.powerOff = {
            name: 'Power Off Display',
            options: [],
            callback: async function (action) {
                if (self.lgtv) {
                    await self.lgtv.powerOff();
                    self.log('info', 'Power off');
                }
            }
        };

        actions.setVolumeMute = {
            name: 'Volume Mute',
            options: [
                {
                    type: 'checkbox',
                    name: 'Mute:',
                    id: 'mute',
                    default: true
                }
            ],
            callback: async function (action) {
                if (self.lgtv) {
                    
                    await self.lgtv.setVolumeMute(action.options.mute);
                    self.log('info', 'Mute');
                }
            }
        };

        actions.setInput = {
            name: 'Set Input',
            options: [
                {
                    type: 'dropdown',
                    id: 'input',
                    name: 'Input:',
                    width: 3,
                    required: true,
                    default: Inputs.dtv,
                    choices: [
                        { id: Inputs.dtv, label: 'Digital TV' },
                        { id: Inputs.atv, label: 'Analog TV' },
                        { id: Inputs.cadtv, label: 'Cable Digital TV' },
                        { id: Inputs.catv, label: 'Cable TV' },
                        { id: Inputs.av, label: 'AV Composite' },
                        { id: Inputs.component, label: 'Component' },
                        { id: Inputs.hdmi1, label: 'HDMI 1' },
                        { id: Inputs.hdmi2, label: 'HDMI 2' },
                        { id: Inputs.hdmi3, label: 'HDMI 3' },
                        { id: Inputs.hdmi4, label: 'HDMI 4' }
                    ]
                }
            ],
            callback: async function (action) {
                if (self.lgtv) {
                    // Set the input source for the TV
                    await self.lgtv.setInput(action.options.input);
                    self.log('info', `Input set to ${action.options.input}`);
                }
            }
        };

        actions.setEnergySaving = {
            name: 'Set Energy Saving',
            options: [
                {
                    type: 'dropdown',
                    id: 'level',
                    name: 'Level:',
                    width: 3,
                    required: true,
                    choices: self.available_energyLevels
                }
            ],
            callback: async function (action) {
                if (self.lgtv) {
                    // Set the energy saving mode for the TV
                    await self.lgtv.setEnergySaving(EnergySavingLevels[action.options.level]);
                    self.log('info', `Energy Saving set to ${action.options.level}`);
                }
            }
        };

        actions.sendKey = {
            name: 'Send Key',
            options: [
                {
                    type: 'dropdown',
                    id: 'key',
                    name: 'Key:',
                    width: 3,
                    required: true,
                    default: self.available_keys?.length > 0 ? self.available_keys[0].id : undefined,
                    choices: self.available_keys
                }
            ],
            callback: async function (action) {
                if (self.lgtv) {
                    // Send the selected key to the TV
                    await self.lgtv.sendKey(action.options.key);
                    self.log('info', `Key ${action.options.key} sent to TV`);
                }
            }
        };

        actions.setVolume = {
            name: 'Set Volume',
            options: [
                {
                    type: 'number',
                    id: 'vol',
                    name: 'Volume Level (0-100):',
                    width: 3,
                    required: true
                }
            ],
            callback: async function (action) {
                if (self.lgtv) {
                    // Set the TV volume
                    await self.lgtv.setVolume(action.options.vol);
                    self.log('info', `Volume set to ${action.options.vol}`);
                }
            }
        };

        self.setActionDefinitions(actions);
    }
};
