const { Inputs } = require('lgtv-ip-control');

module.exports = {
    inputNames: [
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