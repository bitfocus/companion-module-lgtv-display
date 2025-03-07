const { Regex } = require('@companion-module/base');

module.exports = {
  REGEX_IP: /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,  // Regex for IP address
  REGEX_SOMETHING: /.*/, // General catch-all regex

  getConfigFields() {
    return [
      {
        type: 'static-text',
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
              <li>Leave WOL IP at default unless you know what you're doing.</li>
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
        regex: this.REGEX_IP,  // Regex for IP validation
      },
      {
        type: 'textinput',
        id: 'mac',
        label: 'MAC ADDRESS',
        width: 6,
        regex: this.REGEX_SOMETHING,  // Regex for general validation
      },
      {
        type: 'textinput',
        id: 'code',
        label: 'Keycode',
        width: 6,
        regex: this.REGEX_SOMETHING,  // Regex for general validation
      },
      {
        type: 'textinput',
        id: 'wol_ip',
        label: 'Wake-On-LAN IP',
        width: 6,
        default: '255.255.255.255',
        regex: this.REGEX_IP,  // Regex for IP validation
      },
    ];
  },
};
