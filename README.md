# Android Emulator for Codex++

Adds an Android Emulator entry to Codex's right-panel `+` menu.

The tweak mirrors a running Android emulator in a Codex sidebar tab. If no emulator is running, it can start an installed AVD headlessly with `emulator -no-window`.

For running emulators, the primary mirror path keeps an emulator console connection open and uses the console screenshot API. On this machine it gives a much lower first-frame delay and steadier frame cadence than Android's `screenrecord` pipe. For non-emulator Android targets, the tweak falls back to a persistent `adb exec-out` screencap loop.

Emulator pointer input uses the same console connection via `event mouse`, so drags do not pay per-event adb startup overhead. Non-emulator input falls back to a persistent `adb shell`.

## Requirements

- Android SDK platform-tools (`adb`)
- Android SDK emulator (`emulator`)
- At least one installed AVD, or one already connected Android target

On this machine the tweak searches the normal Android SDK locations first, including `~/Library/Android/sdk/platform-tools/adb` and `~/Library/Android/sdk/emulator/emulator`.

## Files

- `index.js` - renderer and main-process tweak entry
- `manifest.json` - tweak metadata
