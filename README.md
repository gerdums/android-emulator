# Android Emulator for Codex++

Adds an Android Emulator entry to Codex's right-panel `+` menu.

The tweak mirrors a running Android emulator in a Codex sidebar tab. If no emulator is running, it can start an installed AVD headlessly with `emulator -no-window`.

For running emulators, the primary mirror path streams `adb exec-out screenrecord --output-format=h264` through `ffmpeg` and sends JPEG frames into the panel. This is much smoother than repeatedly spawning `adb exec-out screencap -p`. The screencap path remains as a fallback for non-emulator Android targets or machines without `ffmpeg`.

Input is sent through a persistent `adb shell`, so taps, back/home, and drag segments avoid per-event adb startup overhead.

## Requirements

- Android SDK platform-tools (`adb`)
- Android SDK emulator (`emulator`)
- `ffmpeg` for the low-latency emulator stream
- At least one installed AVD, or one already connected Android target

On this machine the tweak searches the normal Android SDK locations first, including `~/Library/Android/sdk/platform-tools/adb` and `~/Library/Android/sdk/emulator/emulator`.

## Files

- `index.js` - renderer and main-process tweak entry
- `manifest.json` - tweak metadata
