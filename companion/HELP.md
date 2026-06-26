## LG TV

> Before anything, you need to enable Network IP Control, which is very easy:

- Open the "All Settings" menu on the TV
- Using the remote arrows, navigate to "Connection". For some TVs, this may say "Network" instead.
- Quickly, press 82888 using the remote numeric buttons
- Note the MAC IP addresses for reference and library configuration
- Turn "Network IP Control" on
- Click "Generate Keycode", and take note of the 8 characters code displayed on the message for reference and library configuration. You can generate a new code at any time. Letters must be capitalized.
- If you want to be able to turn the TV on, turn "Wake On LAN" on. By default, the WOL magic packet is sent to 255.255.255.255 but you can change this if you have a complex network setup using static ARP across subnets.

**Available commands in this module**

- Power on
- Power off
- Set input
- Send key
- Set volume
- Mute volume
- Set energy saving level (blank screen)

**Available feedbacks in this module**

- Power state (on/off/unknown)
- Mute state (muted/unmuted)
- IP Control enabled
- Volume compare (=, !=, >, >=, <, <=)
- Current app (known app list or custom app ID)
- Current input (HDMI/AV/Component/Live TV or custom input ID)

**Available variables in this module**

- `power_state` — current power state (on/off/unknown)
- `muted` — mute state (true/false)
- `volume` — current volume (0-100)
- `ip_control_enabled` — IP control enabled (true/false)
- `current_app` — current streaming app friendly name (blank when on a physical input)
- `current_input` — current input friendly name, e.g. HDMI 1 (blank when in an app)
- `current_app_id` — current app/input raw id
