## LG TV

This is module allows network control for most LG TVs manufactured since 2018.

### Configuration

- Open the "All Settings" menu on the TV.
- The IP control settings live in one of two places, depending on the TV's webOS version:
  - **Newer TVs (webOS 6 and later):** All Settings > Support > IP Control Settings. On some
    models this is under General > Devices, or Support > Additional Settings.
  - **Older TVs (2018-2021):** open All Settings, move the focus onto "Connection" (called
    "Network" on some models) _without_ entering it, then quickly press 82888 on the remote
    number pad to reveal the hidden menu.
- Note the MAC and IP addresses shown for client configuration. The MAC address is required to
  remotely power on the TV.
- Enable "Network IP Control".
- For TVs that require encryption, click "Generate Keycode" and note the 8 character code
  displayed. This keycode is required for all commands except power on. A new keycode can be
  generated at any time.
- To allow the TV to be powered on remotely, enable "Wake On LAN" (on newer TVs this may be in
  the same IP Control Settings screen, or under General > Devices > TV Management > Mobile TV On).

### Actions

- Power on
- Power off
- Set input
- Send key
- Set volume
- Mute volume
- Set energy saving level (blank screen)
- Launch app (known app list or custom app ID)
- Set picture mode (Cinema/Game/Vivid/...)
- Set screen mute (blank keeping audio / video mute / unmute)

### Feedbacks

- Power state (on/off/unknown)
- Mute state (muted/unmuted)
- IP Control enabled
- Volume compare (=, !=, >, >=, <, <=)
- Current app (known app list or custom app ID)
- Current input (HDMI/AV/Component/Live TV or custom input ID)
- Signal present (current input is receiving a signal)

### Variables

- `power_state` — current power state (on/off/unknown)
- `muted` — mute state (true/false)
- `volume` — current volume (0-100)
- `ip_control_enabled` — IP control enabled (true/false)
- `current_app` — current streaming app friendly name (blank when on a physical input)
- `current_input` — current input friendly name, e.g. HDMI 1 (blank when in an app)
- `current_app_id` — current app/input raw id
- `signal` — input signal present (true/false, physical inputs only)
- `hdcp_version` — HDCP version of the current input
- `hdcp_status` — HDCP status of the current input

### Presets

Ready-made buttons are grouped into categories: **Power**, **Volume**, **Navigation**
(remote keys), **Inputs**, **Apps**, **Picture Mode**, **Screen Mute**, and **Energy
Saving**. Power, Volume (mute), Inputs, and Apps buttons include feedback so the button
highlights green when it matches the TV's current state.
