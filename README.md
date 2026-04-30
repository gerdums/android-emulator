# Android Emulator for Codex++

Adds an Android Emulator entry to Codex's right-panel `+` menu.

The tweak mirrors a running Android emulator in a Codex sidebar tab. If no emulator is running, it can start an installed AVD headlessly with `emulator -no-window`, then streams frames with `adb exec-out screencap -p`.

## Requirements

- Android SDK platform-tools (`adb`)
- Android SDK emulator (`emulator`)
- At least one installed AVD, or one already connected Android target

On this machine the tweak searches the normal Android SDK locations first, including `~/Library/Android/sdk/platform-tools/adb` and `~/Library/Android/sdk/emulator/emulator`.

## Files

- `index.js` - renderer and main-process tweak entry
- `manifest.json` - tweak metadata
