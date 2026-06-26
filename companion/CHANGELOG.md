# Changelog

All notable changes to this module will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.1.0] - 2026-06-26

### Added

- Feedbacks for live TV state: Power State, Mute State, IP Control Enabled,
  Volume Comparison, Current App, Current Input, and Signal Present.
- Variables mirroring the polled state: `power_state`, `muted`, `volume`,
  `ip_control_enabled`, `current_app`, `current_input`, `current_app_id`,
  `signal`, `hdcp_version`, and `hdcp_status`.
- Presets for Power, Volume, Navigation, Inputs, Apps, Picture Mode, Screen Mute,
  Energy Saving, and read-only Status displays.
- New actions: Launch App (with custom App ID support), Set Picture Mode, and
  Set Screen Mute.
- Background polling loop that keeps feedbacks and variables up to date, with a
  configurable **Feedback poll interval** (set to `0` to disable).

### Changed

- Refactored the module in TypeScript.
- The Volume Mute action is now a Toggle / Mute / Unmute dropdown instead of a
  checkbox.
- The Send Key dropdown now uses friendly, human-readable key labels.
- A powered-off or unreachable TV is now reported as Disconnected and retried
  quietly every 30s, instead of logging repeated connection errors.
- Updated module metadata (manufacturer, products, keywords).

### Fixed

- Send Key values failing to send.

## [2.0.0]

- Initial 2.x release.

[Unreleased]: https://github.com/bitfocus/companion-module-lgtv-display/compare/v2.1.0...HEAD
[2.1.0]: https://github.com/bitfocus/companion-module-lgtv-display/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/bitfocus/companion-module-lgtv-display/releases/tag/v2.0.0
