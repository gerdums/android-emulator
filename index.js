/**
 * co.gerdums.android-emulator
 *
 * Adds an "Android Emulator" tab to Codex's right-panel + menu.
 *
 * - Native-looking right-panel tab + panel, parallel-injected like the iOS
 *   simulator tweak.
 * - Headless emulator launch through the Android SDK emulator.
 * - Frame capture through `adb exec-out screencap -p`.
 * - Pointer input through `adb shell input tap/swipe` and hardware buttons
 *   through Android keyevents.
 */

"use strict";

const TWEAK_ATTR = "data-codexpp-android-emu";
const OTHER_CUSTOM_PANEL_ATTRS = ["data-codexpp-ios-sim"];
const STYLE_ID = "codexpp-android-emu-style";
const MENU_LABEL = "Android Emulator";
const PANEL_LABEL = "Android Emulator";
const BROWSER_PATTERNS = [/^browser$/i, /^browser use$/i, /\bbrowser\b/i];
const PICKER_TITLE_PATTERNS = [/^new chat$/i, /^open file$/i, /^browse files$/i];
const PICKER_SUBTITLE = "Mirror an Android emulator in this pane";

const ANDROID_SVG =
  '<svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 rounded-2xs">' +
  '<path d="M5.5 8.2h9v5.6a1.7 1.7 0 0 1-1.7 1.7H7.2a1.7 1.7 0 0 1-1.7-1.7V8.2z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>' +
  '<path d="M7 8.1a3 3 0 0 1 6 0M7.4 4.4l1 1.7M12.6 4.4l-1 1.7M5.5 10.2H4M16 10.2h-1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>' +
  '<circle cx="8.2" cy="10.4" r="0.55" fill="currentColor"/><circle cx="11.8" cy="10.4" r="0.55" fill="currentColor"/>' +
  "</svg>";
const ANDROID_ICON =
  '<span aria-hidden="true" class="flex h-4 w-4 shrink-0 items-center justify-center">' +
  ANDROID_SVG +
  "</span>";

const SVGS = {
  home:
    '<svg width="16" height="16" viewBox="0 0 20 20" fill="none" class="icon-xs"><path d="M3.5 10.2 10 4.8l6.5 5.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.8 9.5v5.4c0 .7.5 1.2 1.2 1.2h6c.7 0 1.2-.5 1.2-1.2V9.5" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  back:
    '<svg width="16" height="16" viewBox="0 0 20 20" fill="none" class="icon-xs"><path d="M9 5 4 10l5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 10h11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  camera:
    '<svg width="16" height="16" viewBox="0 0 20 20" fill="none" class="icon-xs"><path d="M7 5.5h6l1.1 1.5H16a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 16 16H4a1.5 1.5 0 0 1-1.5-1.5v-6A1.5 1.5 0 0 1 4 7h1.9L7 5.5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="10" cy="11.25" r="2.5" stroke="currentColor" stroke-width="1.5"/></svg>',
  chevron:
    '<svg width="12" height="12" viewBox="0 0 20 20" fill="none" class="icon-xs"><path d="M5 8l5 5 5-5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  close:
    '<svg width="21" height="21" viewBox="0 0 21 21" fill="none" class="icon-xs"><path fill-rule="evenodd" clip-rule="evenodd" d="M10.8 2.485A8.333 8.333 0 1 1 10.8 19.152a8.333 8.333 0 0 1 0-16.667zM9.008 7.518a.876.876 0 0 0-1.383 1.383L9.542 10.818l-1.917 1.916a.876.876 0 1 0 1.383 1.383L10.925 12.2l1.917 1.917a.876.876 0 1 0 1.382-1.383l-1.916-1.916 1.916-1.917a.876.876 0 0 0-1.382-1.383L10.925 9.434 9.008 7.518z" fill="currentColor"/></svg>',
  androidLarge:
    '<svg width="96" height="96" viewBox="0 0 20 20" fill="none"><path d="M4.8 8.2h10.4v6.1a2 2 0 0 1-2 2H6.8a2 2 0 0 1-2-2V8.2z" stroke="currentColor" stroke-width="0.9" stroke-linejoin="round"/><path d="M6.5 8.1a3.5 3.5 0 0 1 7 0M7.2 3.8 8.3 6M12.8 3.8 11.7 6M4.8 10.6H3.4M16.6 10.6h-1.4" stroke="currentColor" stroke-width="0.85" stroke-linecap="round"/><circle cx="8.3" cy="10.4" r="0.55" fill="currentColor"/><circle cx="11.7" cy="10.4" r="0.55" fill="currentColor"/></svg>',
};

module.exports = {
  async start(api) {
    this.api = api;
    this.cleanup = [];

    if (api.process === "main") {
      registerMainHandlers(api, this);
      return;
    }

    injectStyles();
    this.cleanup.push(() => document.getElementById(STYLE_ID)?.remove());
    this.cleanup.push(() => removeEmuPanel());

    await api.react.waitForElement?.("body", 10_000);

    this.observer = new MutationObserver(() => this.installMenuEntries());
    this.observer.observe(document.body, { childList: true, subtree: true });
    this.cleanup.push(() => this.observer?.disconnect());

    this.installMenuEntries();
  },

  stop() {
    this.removeMainHandlers?.();
    this.removeMainHandlers = null;
    if (typeof document === "undefined") return;
    for (const dispose of this.cleanup ?? []) {
      try {
        dispose();
      } catch {}
    }
    this.cleanup = [];
    document.querySelectorAll(`[${TWEAK_ATTR}]`).forEach((node) => node.remove());
    removeEmuPanel();
  },

  installMenuEntries() {
    for (const browserButton of findBrowserMenuButtons()) {
      if (hasExistingMenuEntry(browserButton)) continue;

      const emuButton = browserButton.cloneNode(true);
      emuButton.setAttribute(TWEAK_ATTR, "menu-entry");
      emuButton.setAttribute("aria-label", MENU_LABEL);
      rewriteMenuEntry(emuButton);

      const activate = (event) => {
        event.preventDefault();
        event.stopPropagation();
        const now = Date.now();
        if (emuButton.__codexppLastActivate && now - emuButton.__codexppLastActivate < 400) return;
        emuButton.__codexppLastActivate = now;
        closeTransientMenu(browserButton);
        this.api?.log?.info?.("opening Android Emulator side panel");
        openEmuPanel(this.api);
      };

      emuButton.addEventListener("pointerdown", activate, true);
      emuButton.addEventListener("mousedown", activate, true);
      emuButton.addEventListener("click", activate, true);
      browserButton.insertAdjacentElement("afterend", emuButton);
    }
  },
};

// main process

function registerMainHandlers(api, tweak) {
  const { spawn, spawnSync } = require("node:child_process");
  const electron = require("electron");
  const { ipcMain, webContents } = electron;
  const fs = require("node:fs");
  const os = require("node:os");
  const path = require("node:path");

  const id = api.manifest?.id || "co.gerdums.android-emulator";
  const ch = (name) => `codexpp:${id}:${name}`;
  const channels = [
    "android-emu:devices",
    "android-emu:emulator",
    "android-emu:screenshot",
    "android-emu:capture:start",
    "android-emu:capture:stop",
    "android-emu:input:event",
    "android-emu:preflight",
  ].map(ch);

  const firstLine = (s) =>
    ((s || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean)[0]) || "";

  for (const c of channels) {
    try {
      ipcMain.removeHandler(c);
    } catch {}
  }

  const state = (globalThis.__codexppAndroidEmu = globalThis.__codexppAndroidEmu || {
    serial: null,
    captureTimer: null,
    captureBusy: false,
    lastMeta: null,
    lastError: null,
    touch: null,
    displayCache: new Map(),
    emulatorProcs: new Map(),
  });

  function sdkRoots() {
    return [
      process.env.ANDROID_HOME,
      process.env.ANDROID_SDK_ROOT,
      path.join(os.homedir(), "Library", "Android", "sdk"),
      path.join(os.homedir(), "Android", "Sdk"),
    ].filter(Boolean);
  }

  function findTool(name, relativePath) {
    const exe = process.platform === "win32" ? `${name}.exe` : name;
    for (const root of sdkRoots()) {
      const p = path.join(root, ...relativePath, exe);
      if (fs.existsSync(p)) return p;
    }
    const which = process.platform === "win32" ? "where" : "/usr/bin/which";
    const r = spawnSync(which, [name], { encoding: "utf8" });
    if (r.status === 0 && firstLine(r.stdout)) return firstLine(r.stdout);
    return name;
  }

  const adbPath = findTool("adb", ["platform-tools"]);
  const emulatorPath = findTool("emulator", ["emulator"]);

  function broadcast(channel, ...args) {
    try {
      for (const wc of webContents.getAllWebContents()) {
        if (wc.isDestroyed?.()) continue;
        wc.send(channel, ...args);
      }
    } catch (e) {
      api.log?.warn?.("android-emu broadcast failed", e);
    }
  }

  const FRAME_CHANNEL = ch("android-emu:capture:frame");
  const META_CHANNEL = ch("android-emu:capture:meta");
  const STATUS_CHANNEL = ch("android-emu:capture:status");

  function sendStatus(payload) {
    broadcast(STATUS_CHANNEL, payload);
  }

  function run(command, args, opts = {}) {
    const encoding = opts.encoding === "buffer" ? null : "utf8";
    const timeoutMs = opts.timeoutMs ?? 20_000;
    return new Promise((resolve) => {
      const proc = spawn(command, args, {
        stdio: ["ignore", "pipe", "pipe"],
        env: process.env,
      });
      const stdout = [];
      const stderr = [];
      let done = false;
      const finish = (result) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(result);
      };
      const timer = setTimeout(() => {
        try {
          proc.kill("SIGTERM");
        } catch {}
        finish({
          ok: false,
          code: null,
          stdout: encoding ? "" : Buffer.concat(stdout),
          stderr: `timed out after ${timeoutMs}ms`,
        });
      }, timeoutMs);
      proc.stdout.on("data", (b) => stdout.push(b));
      proc.stderr.on("data", (b) => stderr.push(b));
      proc.on("error", (e) =>
        finish({
          ok: false,
          error: String(e),
          stdout: encoding ? "" : Buffer.concat(stdout),
          stderr: Buffer.concat(stderr).toString("utf8"),
        }),
      );
      proc.on("exit", (code) => {
        const outBuffer = Buffer.concat(stdout);
        const err = Buffer.concat(stderr).toString("utf8");
        finish({
          ok: code === 0,
          code,
          stdout: encoding ? outBuffer.toString(encoding) : outBuffer,
          stderr: err,
        });
      });
    });
  }

  const runAdb = (args, opts) => run(adbPath, args, opts);

  async function listAvds() {
    const r = await run(emulatorPath, ["-list-avds"], { timeoutMs: 10_000 });
    if (!r.ok && !r.stdout) return { ok: false, error: r.stderr || r.error || "emulator -list-avds failed" };
    const avds = String(r.stdout || "")
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    return { ok: true, avds, stderr: r.stderr };
  }

  async function listAdbDevices() {
    const r = await runAdb(["devices", "-l"], { timeoutMs: 10_000 });
    if (!r.ok) return { ok: false, devices: [], error: r.stderr || r.error || "adb devices failed" };
    const devices = [];
    for (const line of String(r.stdout || "").split(/\r?\n/).slice(1)) {
      const text = line.trim();
      if (!text) continue;
      const parts = text.split(/\s+/);
      const serial = parts[0];
      const stateName = parts[1] || "unknown";
      const detail = Object.fromEntries(
        parts.slice(2).map((part) => {
          const idx = part.indexOf(":");
          return idx > 0 ? [part.slice(0, idx), part.slice(idx + 1)] : [part, ""];
        }),
      );
      devices.push({ serial, state: stateName, detail });
    }
    return { ok: true, devices };
  }

  async function getProp(serial, prop) {
    const r = await runAdb(["-s", serial, "shell", "getprop", prop], { timeoutMs: 4_000 });
    return r.ok ? firstLine(r.stdout) : "";
  }

  async function getAvdNameForSerial(serial) {
    if (!/^emulator-\d+$/.test(serial)) return "";
    const r = await runAdb(["-s", serial, "emu", "avd", "name"], { timeoutMs: 4_000 });
    if (!r.ok) return "";
    const lines = String(r.stdout || "")
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s && s !== "OK");
    return lines[0] || "";
  }

  async function describeSerial(serial, raw) {
    const [model, avdName] = await Promise.all([
      getProp(serial, "ro.product.model"),
      getAvdNameForSerial(serial),
    ]);
    const name = model || avdName || raw.detail?.model || serial;
    return {
      id: serial,
      type: /^emulator-\d+$/.test(serial) ? "emulator" : "device",
      serial,
      avdName,
      name,
      state: raw.state === "device" ? "Booted" : raw.state,
      isRunning: raw.state === "device",
      isAvailable: raw.state === "device",
    };
  }

  async function listDevices() {
    const [adb, avd] = await Promise.all([listAdbDevices(), listAvds()]);
    const running = [];
    if (adb.ok) {
      for (const d of adb.devices) {
        running.push(await describeSerial(d.serial, d));
      }
    }

    const runningAvds = new Set(running.map((d) => d.avdName).filter(Boolean));
    const avds = (avd.avds || []).map((name) => {
      const existing = running.find((d) => d.avdName === name);
      return existing || {
        id: `avd:${name}`,
        type: "avd",
        serial: null,
        avdName: name,
        name: name.replace(/_/g, " "),
        state: "Shutdown",
        isRunning: false,
        isAvailable: true,
      };
    });

    return {
      ok: adb.ok || avd.ok,
      data: {
        adbPath,
        emulatorPath,
        devices: [...running, ...avds.filter((d) => !runningAvds.has(d.avdName))],
      },
      adbError: adb.error,
      emulatorError: avd.error,
      emulatorStderr: avd.stderr,
    };
  }

  async function currentRunningDevices() {
    const res = await listDevices();
    return res.ok ? res.data.devices.filter((d) => d.isRunning && d.serial) : [];
  }

  async function waitForBoot(serial, timeoutMs = 120_000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const r = await runAdb(["-s", serial, "shell", "getprop", "sys.boot_completed"], {
        timeoutMs: 5_000,
      });
      if (r.ok && firstLine(r.stdout) === "1") return true;
      await new Promise((resolve) => setTimeout(resolve, 1_500));
    }
    return false;
  }

  async function startAvd(name) {
    const before = await currentRunningDevices();
    const already = before.find((d) => d.avdName === name);
    if (already?.serial) {
      state.serial = already.serial;
      await waitForBoot(already.serial, 10_000);
      return { ok: true, serial: already.serial, status: "already-running" };
    }

    sendStatus({ kind: "starting", message: `Starting ${name}...` });
    const proc = spawn(
      emulatorPath,
      ["-avd", name, "-no-window", "-no-audio", "-no-boot-anim", "-gpu", "swiftshader_indirect"],
      { stdio: ["ignore", "pipe", "pipe"], env: process.env },
    );
    state.emulatorProcs.set(name, proc);
    proc.stdout.on("data", (b) => api.log?.info?.("[android-emulator]", b.toString("utf8").trim()));
    proc.stderr.on("data", (b) => {
      const line = b.toString("utf8").trim();
      if (line) api.log?.info?.("[android-emulator]", line);
    });
    proc.on("exit", (code, signal) => {
      state.emulatorProcs.delete(name);
      api.log?.info?.("android-emu emulator exit", { name, code, signal });
      if (state.serial && state.serial === proc.__codexppSerial) {
        sendStatus({ kind: "stopped", reason: `emulator exited ${code ?? signal ?? ""}`.trim() });
      }
    });
    proc.unref?.();

    const beforeSerials = new Set(before.map((d) => d.serial));
    const started = Date.now();
    let picked = null;
    while (Date.now() - started < 90_000 && !picked) {
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      const running = await currentRunningDevices();
      picked =
        running.find((d) => d.avdName === name) ||
        running.find((d) => !beforeSerials.has(d.serial));
    }
    if (!picked?.serial) {
      return { ok: false, error: `Timed out waiting for ${name} to appear in adb` };
    }
    proc.__codexppSerial = picked.serial;
    state.serial = picked.serial;
    const booted = await waitForBoot(picked.serial);
    return {
      ok: booted,
      serial: picked.serial,
      status: booted ? "started" : "boot-timeout",
      error: booted ? undefined : "Timed out waiting for Android boot to complete",
    };
  }

  async function getDisplaySize(serial) {
    const now = Date.now();
    const cached = state.displayCache.get(serial);
    if (cached && now - cached.at < 10_000) return cached.size;

    const r = await runAdb(["-s", serial, "shell", "wm", "size"], { timeoutMs: 4_000 });
    const text = String(r.stdout || "");
    const matches = [...text.matchAll(/(?:Physical|Override) size:\s*(\d+)x(\d+)/g)];
    const last = matches[matches.length - 1];
    const size = last ? { width: Number(last[1]), height: Number(last[2]) } : { width: 1080, height: 1920 };
    state.displayCache.set(serial, { at: now, size });
    return size;
  }

  async function captureOnce() {
    if (!state.serial || state.captureBusy) return;
    state.captureBusy = true;
    try {
      const r = await runAdb(["-s", state.serial, "exec-out", "screencap", "-p"], {
        encoding: "buffer",
        timeoutMs: 8_000,
      });
      if (!r.ok || !r.stdout?.length) {
        const error = r.stderr || r.error || "empty screencap";
        if (state.lastError !== error) {
          state.lastError = error;
          sendStatus({ kind: "error", error });
        }
        return;
      }
      state.lastError = null;
      const png = normalizePng(r.stdout);
      broadcast(FRAME_CHANNEL, png);
      const size = await getDisplaySize(state.serial).catch(() => null);
      const meta = { serial: state.serial, width: size?.width, height: size?.height };
      state.lastMeta = meta;
      broadcast(META_CHANNEL, meta);
    } catch (e) {
      sendStatus({ kind: "error", error: String(e) });
    } finally {
      state.captureBusy = false;
    }
  }

  function normalizePng(buffer) {
    if (buffer?.[0] === 0x89 && buffer?.[1] === 0x50) return Buffer.from(buffer);
    return Buffer.from(String(buffer).replace(/\r\n/g, "\n"), "binary");
  }

  async function startCapture(serial) {
    if (serial) state.serial = serial;
    if (!state.serial) {
      const running = await currentRunningDevices();
      state.serial = (running.find((d) => d.type === "emulator") || running[0])?.serial || null;
    }
    if (!state.serial) {
      sendStatus({ kind: "stopped", reason: "No running Android emulator" });
      return { ok: false, error: "No running Android emulator" };
    }
    if (state.captureTimer) return { ok: true, status: "already-running", serial: state.serial };
    sendStatus({ kind: "starting", message: "Starting Android capture..." });
    state.captureTimer = setInterval(() => captureOnce(), 550);
    state.captureTimer.unref?.();
    captureOnce();
    return { ok: true, status: "started", serial: state.serial };
  }

  function stopCapture(reason) {
    if (state.captureTimer) {
      clearInterval(state.captureTimer);
      state.captureTimer = null;
    }
    state.captureBusy = false;
    if (reason) sendStatus({ kind: "stopped", reason });
  }

  async function runShellInput(serial, args) {
    return runAdb(["-s", serial, "shell", "input", ...args.map(String)], { timeoutMs: 8_000 });
  }

  ipcMain.handle(ch("android-emu:input:event"), async (_evt, event) => {
    const serial = state.serial;
    if (!serial) return { ok: false, error: "No active Android target" };
    if (!event || typeof event !== "object") return { ok: false, error: "Invalid input event" };

    if (event.type === "button-tap") {
      const map = { home: 3, back: 4, recents: 187, power: 26 };
      const key = map[event.name] || 3;
      const r = await runShellInput(serial, ["keyevent", key]);
      return { ok: r.ok, error: r.stderr || r.error };
    }

    if (event.type !== "touch") return { ok: false, error: "Unsupported input event" };
    const size = await getDisplaySize(serial);
    const point = {
      x: Math.max(0, Math.min(size.width - 1, Math.round(Number(event.x) * size.width))),
      y: Math.max(0, Math.min(size.height - 1, Math.round(Number(event.y) * size.height))),
      at: Date.now(),
    };

    if (event.phase === "down") {
      state.touch = { start: point, last: point };
      return { ok: true };
    }
    if (event.phase === "move") {
      if (state.touch) state.touch.last = point;
      return { ok: true };
    }
    if (event.phase === "up") {
      const start = state.touch?.start || point;
      state.touch = null;
      const dx = point.x - start.x;
      const dy = point.y - start.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 12) {
        const r = await runShellInput(serial, ["tap", point.x, point.y]);
        return { ok: r.ok, error: r.stderr || r.error };
      }
      const duration = Math.max(80, Math.min(1500, point.at - start.at));
      const r = await runShellInput(serial, ["swipe", start.x, start.y, point.x, point.y, duration]);
      return { ok: r.ok, error: r.stderr || r.error };
    }

    return { ok: true };
  });

  const osModule = os;
  ipcMain.handle(ch("android-emu:screenshot"), async (_evt, filename) => {
    const safe = String(filename || "").replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 128);
    if (!safe || !/\.png$/i.test(safe)) return { ok: false, error: "filename must end in .png" };
    if (!state.serial) return { ok: false, error: "No active Android target" };
    const dest = path.join(osModule.homedir(), "Desktop", safe);
    const r = await runAdb(["-s", state.serial, "exec-out", "screencap", "-p"], {
      encoding: "buffer",
      timeoutMs: 10_000,
    });
    if (!r.ok || !r.stdout?.length) return { ok: false, error: r.stderr || r.error || "empty screencap" };
    fs.writeFileSync(dest, normalizePng(r.stdout));
    return { ok: true, path: dest };
  });

  ipcMain.handle(ch("android-emu:devices"), async () => listDevices());

  ipcMain.handle(ch("android-emu:emulator"), async (_evt, args) => {
    const list = Array.isArray(args) ? args.map(String) : [];
    const verb = list[0];
    if (verb !== "start") return { ok: false, error: "verb not allowed: " + verb };
    const avdName = list[1] || "";
    if (!/^[A-Za-z0-9._ -]+$/.test(avdName)) return { ok: false, error: "invalid AVD name" };
    return startAvd(avdName);
  });

  ipcMain.handle(ch("android-emu:capture:start"), async (_evt, serial) => startCapture(serial ? String(serial) : null));

  ipcMain.handle(ch("android-emu:capture:stop"), async () => {
    stopCapture("client-stop");
    return { ok: true };
  });

  ipcMain.handle(ch("android-emu:preflight"), async () => {
    const adbCheck = await run(adbPath, ["version"], { timeoutMs: 5_000 });
    if (!adbCheck.ok) {
      return {
        ok: false,
        reason: "adb",
        message: "Android platform-tools are not available.",
        hint: "Install Android Studio or platform-tools, then make sure adb is available.",
        detail: adbCheck.stderr || adbCheck.error || adbPath,
      };
    }
    const emuCheck = await listAvds();
    const adbDevices = await listAdbDevices();
    if (!emuCheck.ok && !adbDevices.devices?.length) {
      return {
        ok: false,
        reason: "emulator",
        message: "Android emulator tooling is not available.",
        hint: "Install Android Studio's emulator package and create an AVD.",
        detail: emuCheck.error || emulatorPath,
      };
    }
    if (!emuCheck.avds?.length && !adbDevices.devices?.length) {
      return {
        ok: false,
        reason: "no-devices",
        message: "No Android AVDs or connected Android targets were found.",
        hint: "Create an AVD in Android Studio, then reopen this panel.",
        detail: "",
      };
    }
    return { ok: true, adbPath, emulatorPath, avds: emuCheck.avds || [] };
  });

  tweak.removeMainHandlers = () => {
    stopCapture();
    for (const c of channels) {
      try {
        ipcMain.removeHandler(c);
      } catch {}
    }
  };

  api.log?.info?.("android-emulator main handlers registered", { adbPath, emulatorPath });
}

// styles

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    [${TWEAK_ATTR}="menu-entry"] svg { color: inherit; }
    [${TWEAK_ATTR}="side-tab"][data-selected="true"] > div {
      background: color-mix(in oklab, var(--color-token-text-primary) 8%, transparent);
    }
    [${TWEAK_ATTR}="side-tab"][data-selected="true"] .pointer-events-none {
      background: color-mix(in oklab, var(--color-token-text-primary) 8%, transparent);
    }
    [${TWEAK_ATTR}="tabpanel"] {
      background: var(--color-background-panel, var(--color-token-bg-fog));
    }
    [${TWEAK_ATTR}="toolbar-button"] {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      height: var(--token-button-composer-height, 28px);
      padding: 0 0.5rem;
      border-radius: 0.5rem;
      border: 1px solid transparent;
      color: var(--color-token-description-foreground, var(--color-token-text-secondary));
      background: transparent;
      cursor: pointer;
      font-size: 0.875rem;
    }
    [${TWEAK_ATTR}="toolbar-button"][data-square="true"] {
      width: var(--token-button-composer-height, 28px);
      padding: 0;
      justify-content: center;
    }
    [${TWEAK_ATTR}="toolbar-button"]:hover {
      background: var(--color-token-list-hover-background, color-mix(in oklab, var(--color-token-text-primary) 8%, transparent));
    }
    [${TWEAK_ATTR}="status"] {
      margin-top: 0.5rem;
      font-size: 0.75rem;
      color: var(--color-token-text-tertiary, var(--color-token-text-secondary));
    }
    @keyframes codexpp-android-emu-progress {
      from { transform: translateX(-100%); }
      to { transform: translateX(250%); }
    }
  `;
  document.head.appendChild(style);
}

// menu detection

function findBrowserMenuButtons() {
  const found = new Set();
  const radixCandidates = Array.from(
    document.querySelectorAll(
      '[role="menuitem"], [role="menu"] button, [data-radix-popper-content-wrapper] button',
    ),
  );
  for (const node of radixCandidates) {
    if (!(node instanceof HTMLElement)) continue;
    if (node.getAttribute(TWEAK_ATTR)) continue;
    if (!isMenuCandidate(node)) continue;
    if (
      matchesBrowserText(extractLabel(node)) ||
      matchesBrowserText(compactText(node.textContent || ""))
    ) {
      found.add(node);
    }
  }

  for (const dialog of document.querySelectorAll('[role="dialog"]')) {
    if (!(dialog instanceof HTMLElement)) continue;
    const rows = dialog.querySelectorAll(
      "button.flex.w-full, [data-codexpp-spitscreen-picker-row]",
    );
    for (const row of rows) {
      if (!(row instanceof HTMLElement)) continue;
      if (row.getAttribute(TWEAK_ATTR)) continue;
      const title = compactText(
        row.querySelector("[data-codexpp-spitscreen-picker-title]")?.textContent ||
          row.querySelector("span")?.textContent ||
          "",
      );
      const text = compactText(row.textContent || "");
      if (PICKER_TITLE_PATTERNS.some((p) => p.test(title)) || /^\+?New chat\b/i.test(text)) {
        found.add(row);
        break;
      }
    }
  }

  return Array.from(found);
}

function hasExistingMenuEntry(origin) {
  const parent = origin.parentElement;
  if (!parent) return false;
  return Array.from(parent.children).some(
    (node) => node !== origin && node.getAttribute?.(TWEAK_ATTR) === "menu-entry",
  );
}

function isMenuCandidate(node) {
  if (node.closest('[role="tablist"], [role="tabpanel"]')) return false;
  if (node.getAttribute("role") === "menuitem") return true;
  if (node.closest('[role="dialog"]')) return true;
  return Boolean(
    node.closest('[role="menu"], [data-radix-popper-content-wrapper], [data-side][data-align]'),
  );
}

function rewriteMenuEntry(button) {
  rewriteMenuLabel(button);
  rewriteMenuIcon(button);
}

function rewriteMenuLabel(button) {
  const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) textNodes.push(node);

  for (const node of textNodes) {
    if (matchesBrowserText(compactText(node.nodeValue || ""))) {
      node.nodeValue = (node.nodeValue || "")
        .replace(/Browser use/i, MENU_LABEL)
        .replace(/Browser/i, MENU_LABEL);
      removeShortcutHints(button);
      return;
    }
  }

  let setTitle = false;
  for (const node of textNodes) {
    const t = compactText(node.nodeValue || "");
    if (!t) continue;
    if (!setTitle && PICKER_TITLE_PATTERNS.some((p) => p.test(t.replace(/^\+/, "")))) {
      node.nodeValue = (node.nodeValue || "").replace(/(\+?)[A-Za-z][^\n]*/, "$1" + MENU_LABEL);
      setTitle = true;
      continue;
    }
    if (setTitle) {
      node.nodeValue = PICKER_SUBTITLE;
      break;
    }
  }
  removeShortcutHints(button);
}

function rewriteMenuIcon(button) {
  const ariaIcon = button.querySelector('span[aria-hidden="true"]');
  if (ariaIcon?.querySelector("svg")) {
    ariaIcon.innerHTML = ANDROID_SVG;
    return;
  }
  const svg = button.querySelector("svg");
  if (svg) {
    svg.replaceWith(htmlToElement(ANDROID_SVG));
    return;
  }
  button.prepend(htmlToElement(ANDROID_ICON));
}

function removeShortcutHints(button) {
  for (const node of Array.from(button.querySelectorAll("kbd, span"))) {
    const text = compactText(node.textContent || "");
    if (text !== MENU_LABEL && (/^[⌘⇧⌥⌃^]+/.test(text) || /Cmd|Ctrl|Alt|Shift|⌘/.test(text))) {
      node.remove();
    }
  }
}

function closeTransientMenu(origin) {
  const menuRoot =
    origin.closest('[role="menu"]') ||
    origin.closest("[data-radix-popper-content-wrapper]") ||
    origin.closest("[data-state]");
  if (menuRoot instanceof HTMLElement) {
    menuRoot.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  }
}

// side panel

function openEmuPanel(api) {
  ensureSidePanelVisible();
  setTimeout(() => {
    let mounted = false;
    try {
      mounted = mountEmuPanel(api);
    } catch (err) {
      api?.log?.error?.("android-emu mountEmuPanel threw", String(err?.stack || err));
    }
    if (!mounted) api?.log?.warn?.("android-emu could not find side panel host");
  }, 16);
}

function mountEmuPanel(api) {
  const tablist = findRightTablist();
  if (!(tablist instanceof HTMLElement)) return false;
  const panelHost = tablist.closest(".flex.h-full.min-h-0.flex-col");
  if (!(panelHost instanceof HTMLElement)) return false;
  installNativeTabDeactivation(tablist, panelHost);
  installTablistDrag(tablist);

  let tab = document.querySelector(`[${TWEAK_ATTR}="side-tab"]`);
  let panel = document.querySelector(`[${TWEAK_ATTR}="tabpanel"]`);

  if (!tab) {
    tab = createSideTab();
    tablist.appendChild(tab);
  }
  if (!panel) {
    panel = createPanel(api);
    panelHost.appendChild(panel);
  }

  activateEmuPanel(panelHost, tab, panel);
  return true;
}

function createSideTab() {
  const controller = document.createElement("div");
  controller.setAttribute(TWEAK_ATTR, "side-tab");
  controller.setAttribute("data-app-shell-tab-controller", "right");
  controller.setAttribute("data-tab-id", "android-emulator");
  controller.className =
    "my-auto flex shrink-0 relative max-w-40 pe-1 items-center contain-content gap-0.5";

  const shell = document.createElement("div");
  shell.setAttribute("data-tab-id", "android-emulator");
  shell.setAttribute("aria-roledescription", "sortable");
  shell.className =
    "group/tab relative flex max-w-39 shrink-0 items-center overflow-hidden rounded-md bg-token-main-surface-primary px-2 py-1";
  shell.setAttribute("role", "button");
  shell.tabIndex = 0;
  shell.style.setProperty(
    "--app-shell-tab-background",
    "color-mix(in srgb, var(--color-token-foreground) 5%, var(--color-token-main-surface-primary))",
  );

  const bg = document.createElement("div");
  bg.className =
    "pointer-events-none absolute inset-0 z-0 rounded-md group-hover/tab:bg-[var(--app-shell-tab-background)]";

  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("role", "tab");
  button.className =
    "no-drag relative flex flex-1 items-center gap-2 z-10 text-sm min-w-0 overflow-hidden text-token-text-secondary";

  const iconSpan = document.createElement("span");
  iconSpan.setAttribute("aria-hidden", "true");
  iconSpan.className =
    "icon-xs flex shrink-0 items-center justify-center group-hover/tab:invisible";
  iconSpan.innerHTML = ANDROID_SVG;

  const close = document.createElement("div");
  close.setAttribute("role", "button");
  close.setAttribute("aria-label", `Close ${MENU_LABEL} tab`);
  close.setAttribute(TWEAK_ATTR, "close-tab");
  close.className =
    "no-drag shrink-0 cursor-interaction items-center justify-center group-hover/tab:flex after:content-[''] after:absolute after:-inset-2 hidden absolute start-1 z-30 size-5 top-1/2 -translate-y-1/2 text-token-text-tertiary hover:text-token-text-primary";
  close.innerHTML = SVGS.close;
  close.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  close.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeEmuTab();
  });

  const labelSpan = document.createElement("span");
  labelSpan.className = "inline-block min-w-0 whitespace-nowrap";
  labelSpan.textContent = MENU_LABEL;

  button.append(iconSpan, close, labelSpan);
  button.addEventListener("click", () => {
    const panelHost = controller.closest(".flex.h-full.min-h-0.flex-col");
    const panel = document.querySelector(`[${TWEAK_ATTR}="tabpanel"]`);
    if (panelHost instanceof HTMLElement && panel instanceof HTMLElement) {
      activateEmuPanel(panelHost, controller, panel);
    }
  });

  shell.append(bg, button);
  controller.appendChild(shell);

  const sep = document.createElement("div");
  sep.setAttribute("aria-hidden", "true");
  sep.setAttribute("data-app-shell-tab-separator", "android-emulator");
  sep.className =
    "h-3 w-px shrink-0 end-0 absolute bg-token-border transition-opacity duration-200 opacity-0";
  controller.appendChild(sep);

  controller.draggable = true;
  controller.addEventListener("dragstart", (e) => {
    if (!e.dataTransfer) return;
    if (e.target instanceof Element && e.target.closest(`[${TWEAK_ATTR}="close-tab"]`)) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.effectAllowed = "move";
    try {
      e.dataTransfer.setData("text/x-codexpp-android-emu", "1");
    } catch {}
    controller.dataset.codexppDragging = "1";
    controller.style.opacity = "0.4";
  });
  controller.addEventListener("dragend", () => {
    delete controller.dataset.codexppDragging;
    controller.style.opacity = "";
  });

  return controller;
}

function closeEmuTab() {
  const panelHost = findRightTablist()?.closest(".flex.h-full.min-h-0.flex-col");
  if (panelHost instanceof HTMLElement) deactivateEmuPanel(panelHost);
  document.querySelector(`[${TWEAK_ATTR}="side-tab"]`)?.remove();
  document.querySelector(`[${TWEAK_ATTR}="tabpanel"]`)?.remove();
  const firstNative = panelHost?.querySelector?.(
    '[role="tablist"] [data-app-shell-tab-controller] [role="tab"]',
  );
  if (firstNative instanceof HTMLElement) firstNative.click();
}

function installTablistDrag(tablist) {
  if (!(tablist instanceof HTMLElement) || tablist.__codexppAndroidEmuDragWired) return;
  tablist.__codexppAndroidEmuDragWired = true;
  tablist.addEventListener("dragover", (e) => {
    const dragging = tablist.querySelector(
      `[${TWEAK_ATTR}="side-tab"][data-codexpp-dragging="1"]`,
    );
    if (!dragging) return;
    e.preventDefault();
    const target =
      e.target instanceof Element
        ? e.target.closest('[data-app-shell-tab-controller], [' + TWEAK_ATTR + '="side-tab"]')
        : null;
    if (!(target instanceof HTMLElement) || target === dragging) return;
    const rect = target.getBoundingClientRect();
    const before = e.clientX < rect.left + rect.width / 2;
    if (before) target.parentElement.insertBefore(dragging, target);
    else target.parentElement.insertBefore(dragging, target.nextSibling);
  });
  tablist.addEventListener("drop", (e) => e.preventDefault());
}

function installNativeTabDeactivation(tablist, panelHost) {
  if (tablist.__codexppAndroidEmuWired) return;
  tablist.__codexppAndroidEmuWired = true;

  const handleNativeTab = (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const tab = target?.closest?.('[role="tab"]');
    if (!(tab instanceof HTMLElement)) return;
    if (tab.closest(`[${TWEAK_ATTR}="side-tab"]`)) return;
    deactivateEmuPanel(panelHost);
  };

  tablist.addEventListener("click", handleNativeTab);
  tablist.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    handleNativeTab(event);
  });
}

function createPanel(api) {
  const panel = document.createElement("div");
  panel.setAttribute(TWEAK_ATTR, "tabpanel");
  panel.setAttribute("role", "tabpanel");
  panel.setAttribute("aria-label", PANEL_LABEL);
  panel.className = "relative flex min-h-0 flex-1 flex-col overflow-hidden";
  panel.__codexppAndroidEmuApi = api;

  const toolbarHost = document.createElement("div");
  toolbarHost.className =
    "relative z-10 h-toolbar-pane min-w-0 shrink-0 border-b border-token-border";
  const toolbar = document.createElement("div");
  toolbar.className =
    "flex h-full min-w-0 items-center gap-1 px-2 text-token-description-foreground";
  toolbarHost.appendChild(toolbar);
  panel.appendChild(toolbarHost);

  toolbar.appendChild(
    makeToolbarButton({
      label: "Back",
      icon: SVGS.back,
      onClick: () => onHardwareButton(panel, api, "back"),
    }),
  );
  toolbar.appendChild(
    makeToolbarButton({
      label: "Home",
      icon: SVGS.home,
      onClick: () => onHardwareButton(panel, api, "home"),
    }),
  );
  toolbar.appendChild(
    makeToolbarButton({
      label: "Screenshot",
      icon: SVGS.camera,
      onClick: () => onScreenshot(panel, api),
    }),
  );

  const spacer = document.createElement("div");
  spacer.className = "flex-1";
  toolbar.appendChild(spacer);

  const devicePickerButton = makeDevicePickerButton(panel, api);
  toolbar.appendChild(devicePickerButton);
  panel.__codexppAndroidEmuDevicePickerButton = devicePickerButton;

  const content = document.createElement("div");
  content.className =
    "relative flex h-full min-h-0 w-full items-center justify-center overflow-hidden";
  content.style.background = "var(--color-token-bg-fog, #000)";

  const stage = document.createElement("div");
  stage.className = "relative flex h-full w-full items-center justify-center";
  stage.style.padding = "24px 12px";

  const mirror = document.createElement("img");
  mirror.alt = "Android Emulator";
  mirror.draggable = false;
  mirror.style.maxWidth = "100%";
  mirror.style.maxHeight = "100%";
  mirror.style.objectFit = "contain";
  mirror.style.display = "none";
  mirror.style.userSelect = "none";
  mirror.style.touchAction = "none";
  mirror.style.borderRadius = "18px";
  mirror.style.boxShadow = "0 10px 40px rgba(0,0,0,0.35)";
  stage.appendChild(mirror);

  let pointerDown = false;
  let activePointerId = null;
  function imgRatio(evt) {
    const rect = mirror.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    let x = (evt.clientX - rect.left) / rect.width;
    let y = (evt.clientY - rect.top) / rect.height;
    if (x < 0) x = 0;
    else if (x > 1) x = 1;
    if (y < 0) y = 0;
    else if (y > 1) y = 1;
    return { x, y };
  }
  function send(event) {
    try {
      api.ipc.invoke("android-emu:input:event", event).catch(() => {});
    } catch {}
  }
  mirror.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const r = imgRatio(e);
    if (!r) return;
    pointerDown = true;
    activePointerId = e.pointerId;
    try {
      mirror.setPointerCapture(e.pointerId);
    } catch {}
    send({ type: "touch", phase: "down", x: r.x, y: r.y });
    e.preventDefault();
  });
  mirror.addEventListener("pointermove", (e) => {
    if (!pointerDown || e.pointerId !== activePointerId) return;
    const r = imgRatio(e);
    if (!r) return;
    send({ type: "touch", phase: "move", x: r.x, y: r.y });
  });
  function endPointer(e) {
    if (!pointerDown || e.pointerId !== activePointerId) return;
    const r = imgRatio(e) || { x: 0.5, y: 0.5 };
    pointerDown = false;
    activePointerId = null;
    try {
      mirror.releasePointerCapture(e.pointerId);
    } catch {}
    send({ type: "touch", phase: "up", x: r.x, y: r.y });
  }
  mirror.addEventListener("pointerup", endPointer);
  mirror.addEventListener("pointercancel", endPointer);
  mirror.addEventListener("contextmenu", (e) => e.preventDefault());

  const placeholder = document.createElement("div");
  placeholder.className =
    "absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-token-text-secondary pointer-events-none";
  placeholder.innerHTML =
    `<div style="opacity:0.5">${SVGS.androidLarge}</div>` +
    `<div class="text-base text-token-text-primary">${PANEL_LABEL}</div>` +
    `<div class="text-sm max-w-[320px]" ${TWEAK_ATTR}="placeholder-message">Starting an Android emulator headlessly. Mirroring will begin as soon as adb can capture frames.</div>` +
    `<div ${TWEAK_ATTR}="progress" class="text-token-text-tertiary" style="width:200px;height:2px;border-radius:2px;background:color-mix(in oklab,currentColor 15%,transparent);overflow:hidden;margin-top:4px;position:relative"><div style="position:absolute;inset:0;width:40%;border-radius:2px;background:currentColor;opacity:0.7;animation:codexpp-android-emu-progress 1.6s linear infinite;will-change:transform"></div></div>`;
  stage.appendChild(placeholder);

  content.appendChild(stage);
  panel.__codexppAndroidEmuPlaceholder = placeholder;
  panel.__codexppAndroidEmuMirror = mirror;
  panel.__codexppAndroidEmuStage = stage;
  panel.appendChild(content);

  let lastUrl = null;
  const onFrame = (payload) => {
    if (!payload) return;
    const u8 = payload instanceof Uint8Array ? payload : new Uint8Array(payload);
    const url = URL.createObjectURL(new Blob([u8], { type: "image/png" }));
    const prev = lastUrl;
    lastUrl = url;
    mirror.onload = () => {
      if (prev) URL.revokeObjectURL(prev);
    };
    mirror.src = url;
    if (mirror.style.display === "none") {
      mirror.style.display = "";
      placeholder.style.display = "none";
    }
  };
  const onMeta = (meta) => {
    panel.__codexppAndroidEmuMeta = meta;
    api.log?.info?.("android-emu stream meta", meta);
  };
  const onStatus = (status) => {
    if (!status) return;
    if (status.kind === "starting") setStatus(panel, status.message || "Starting Android capture...");
    else if (status.kind === "stopped") {
      mirror.style.display = "none";
      placeholder.style.display = "";
      if (status.reason && status.reason !== "client-stop") {
        setStatus(panel, "Capture stopped: " + status.reason);
      }
    } else if (status.kind === "error") {
      mirror.style.display = "none";
      placeholder.style.display = "";
      setStatus(panel, "Capture error: " + (status.error || "unknown"));
    }
  };

  panel.__codexppAndroidEmuAttachCapture = (serial) => {
    if (!panel.__codexppAndroidEmuCaptureAttached) {
      panel.__codexppAndroidEmuCaptureAttached = true;
      panel.__codexppAndroidEmuCaptureOff = [
        api.ipc.on("android-emu:capture:frame", onFrame),
        api.ipc.on("android-emu:capture:meta", onMeta),
        api.ipc.on("android-emu:capture:status", onStatus),
      ];
    }
    api.ipc.invoke("android-emu:capture:start", serial || null).catch((e) =>
      setStatus(panel, "Capture start failed: " + e),
    );
  };

  panel.__codexppAndroidEmuDetachCapture = () => {
    if (!panel.__codexppAndroidEmuCaptureAttached) return;
    panel.__codexppAndroidEmuCaptureAttached = false;
    for (const off of panel.__codexppAndroidEmuCaptureOff || []) {
      try {
        if (typeof off === "function") off();
      } catch {}
    }
    panel.__codexppAndroidEmuCaptureOff = null;
    api.ipc.invoke("android-emu:capture:stop").catch(() => {});
    if (lastUrl) {
      URL.revokeObjectURL(lastUrl);
      lastUrl = null;
    }
    mirror.removeAttribute("src");
    mirror.style.display = "none";
    placeholder.style.display = "";
  };

  return panel;
}

function makeToolbarButton({ label, icon, text, onClick }) {
  const b = document.createElement("button");
  b.type = "button";
  b.setAttribute(TWEAK_ATTR, "toolbar-button");
  b.setAttribute("aria-label", label);
  b.setAttribute("title", label);
  if (!text) b.setAttribute("data-square", "true");
  if (icon) {
    const i = document.createElement("span");
    i.className = "flex shrink-0 items-center justify-center";
    i.innerHTML = icon;
    b.appendChild(i);
  }
  if (text) {
    const t = document.createElement("span");
    t.textContent = text;
    b.appendChild(t);
  }
  b.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      onClick?.();
    } catch {}
  });
  return b;
}

function isOtherCustomPanel(panel) {
  return OTHER_CUSTOM_PANEL_ATTRS.some((attr) => panel.hasAttribute(attr));
}

function activateEmuPanel(panelHost, tab, panel) {
  for (const nativePanel of panelHost.querySelectorAll(':scope > [role="tabpanel"]')) {
    if (nativePanel === panel) continue;
    if (!nativePanel.hasAttribute("data-codexpp-android-emu-prev-display")) {
      nativePanel.setAttribute(
        "data-codexpp-android-emu-prev-display",
        nativePanel.style.display || "",
      );
    }
    nativePanel.style.display = "none";
  }

  for (const nativeTab of panelHost.querySelectorAll('[role="tab"]')) {
    nativeTab.setAttribute("aria-selected", "false");
    nativeTab.classList.remove("text-token-text-primary");
    nativeTab.classList.add("text-token-text-secondary");
  }

  const tabButton = tab.querySelector('[role="tab"]');
  tab.dataset.selected = "true";
  tabButton?.setAttribute("aria-selected", "true");
  tabButton?.classList.remove("text-token-text-secondary");
  tabButton?.classList.add("text-token-text-primary");
  panel.style.display = "";

  const api = panel.__codexppAndroidEmuApi;
  if (!api) return;

  const showPreflightFailure = (pf) => {
    const placeholder = panel.__codexppAndroidEmuPlaceholder;
    const msg = placeholder?.querySelector(`[${TWEAK_ATTR}="placeholder-message"]`);
    const progress = placeholder?.querySelector(`[${TWEAK_ATTR}="progress"]`);
    if (msg) {
      const hint = pf?.hint ? `\n\n${pf.hint}` : "";
      msg.textContent = (pf?.message || "Android Emulator unavailable.") + hint;
      msg.style.whiteSpace = "pre-line";
    }
    progress?.remove();
    api.log?.warn?.("android-emu preflight failed", pf);
  };

  api.ipc
    .invoke("android-emu:preflight")
    .then((pf) => {
      if (!pf?.ok) {
        showPreflightFailure(pf);
        return;
      }
      return ensureBootedDevice(panel, api).then((serial) => {
        panel.__codexppAndroidEmuAttachCapture?.(serial);
        return refreshDeviceLabel(panel, api);
      });
    })
    .catch((e) => {
      showPreflightFailure({
        message: "Android Emulator preflight failed.",
        hint: String(e?.message || e || ""),
      });
    });
}

function deactivateEmuPanel(panelHost) {
  const tabWrap = document.querySelector(`[${TWEAK_ATTR}="side-tab"]`);
  const tab = tabWrap?.querySelector('[role="tab"]');
  const panel = document.querySelector(`[${TWEAK_ATTR}="tabpanel"]`);
  tabWrap?.removeAttribute("data-selected");
  tab?.setAttribute("aria-selected", "false");
  tab?.classList.remove("text-token-text-primary");
  tab?.classList.add("text-token-text-secondary");
  if (panel instanceof HTMLElement) {
    panel.style.display = "none";
    try {
      panel.__codexppAndroidEmuDetachCapture?.();
    } catch {}
  }

  for (const nativePanel of panelHost.querySelectorAll(':scope > [role="tabpanel"]')) {
    if (nativePanel === panel || isOtherCustomPanel(nativePanel)) continue;
    const previous = nativePanel.getAttribute("data-codexpp-android-emu-prev-display");
    if (previous !== null) {
      nativePanel.style.display = previous;
      nativePanel.removeAttribute("data-codexpp-android-emu-prev-display");
    }
  }
}

function removeEmuPanel() {
  const panelHost = findRightTablist()?.closest(".flex.h-full.min-h-0.flex-col");
  if (panelHost instanceof HTMLElement) deactivateEmuPanel(panelHost);
  document.querySelector(`[${TWEAK_ATTR}="side-tab"]`)?.remove();
  document.querySelector(`[${TWEAK_ATTR}="tabpanel"]`)?.remove();
}

function ensureSidePanelVisible() {
  if (findRightTablist()) return;
  const toggle = document.querySelector('button[aria-label="Toggle side panel"][aria-pressed="false"]');
  if (toggle instanceof HTMLElement) toggle.click();
}

function findRightTablist() {
  const addButton = document.querySelector('button[aria-label="Open side panel tab"]');
  const toolbar = addButton?.closest(".flex.h-toolbar-pane");
  return toolbar?.querySelector('[role="tablist"]') || null;
}

// toolbar handlers

async function onHardwareButton(panel, api, button) {
  const map = { home: "home", back: "back", recents: "recents", power: "power" };
  const name = map[button] || "home";
  const res = await api.ipc.invoke("android-emu:input:event", {
    type: "button-tap",
    name,
  });
  if (!res?.ok) setStatus(panel, `${button} failed: ${res?.error || "?"}`);
  else api.log?.info?.("android-emu button", name);
}

async function onScreenshot(panel, api) {
  setStatus(panel, "Saving screenshot to ~/Desktop...");
  const fname = `android-emulator-${Date.now()}.png`;
  const res = await api.ipc.invoke("android-emu:screenshot", fname);
  if (res?.ok) setStatus(panel, "Saved to Desktop: " + fname);
  else setStatus(panel, "Screenshot failed: " + (res?.stderr || res?.error || "unknown"));
}

async function openDevicePicker(panel, api) {
  const existing = document.querySelector(`[${TWEAK_ATTR}="device-popover"]`);
  if (existing) {
    existing.remove();
    return;
  }
  const button = panel.__codexppAndroidEmuDevicePickerButton;
  if (!button) return;

  const res = await api.ipc.invoke("android-emu:devices");
  if (!res?.ok) {
    setStatus(panel, "Android tooling unavailable: " + (res?.adbError || res?.emulatorError || ""));
    return;
  }

  const devices = res.data?.devices || [];
  const running = devices.filter((d) => d.isRunning);
  const avds = devices.filter((d) => !d.isRunning && d.type === "avd");

  const pop = document.createElement("div");
  pop.setAttribute(TWEAK_ATTR, "device-popover");
  pop.setAttribute("role", "menu");
  pop.tabIndex = -1;
  pop.className =
    "fixed z-[9999] max-h-[420px] min-w-[280px] overflow-y-auto rounded-lg border border-token-border bg-token-main-surface-primary py-1 shadow-xl text-sm";
  const br = button.getBoundingClientRect();
  pop.style.position = "fixed";
  pop.style.top = br.bottom + 4 + "px";
  pop.style.right = window.innerWidth - br.right + "px";
  pop.style.zIndex = "9999";

  let anyShown = false;
  appendDeviceGroup(pop, "Running", running, panel, api, () => {
    anyShown = true;
  });
  appendDeviceGroup(pop, "Available AVDs", avds, panel, api, () => {
    anyShown = true;
  });

  if (!anyShown) {
    const empty = document.createElement("div");
    empty.className = "px-3 py-2 text-token-text-tertiary";
    empty.textContent = "No Android emulators available.";
    pop.appendChild(empty);
  }

  document.body.appendChild(pop);
  const dismiss = (ev) => {
    if (pop.contains(ev.target) || button.contains(ev.target)) return;
    pop.remove();
    document.removeEventListener("mousedown", dismiss, true);
  };
  setTimeout(() => document.addEventListener("mousedown", dismiss, true), 0);
}

function appendDeviceGroup(pop, title, list, panel, api, markShown) {
  if (!list.length) return;
  markShown();
  const header = document.createElement("div");
  header.className =
    "px-3 py-1 text-xs font-medium text-token-text-tertiary uppercase tracking-wide";
  header.textContent = title;
  pop.appendChild(header);

  for (const d of list) {
    const item = document.createElement("button");
    item.type = "button";
    item.setAttribute("role", "menuitem");
    item.setAttribute(TWEAK_ATTR, "device-item");
    item.className =
      "flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left hover:bg-token-list-hover-background";
    const left = document.createElement("span");
    left.className = "truncate";
    left.textContent = d.name || d.avdName || d.serial;
    const right = document.createElement("span");
    right.className = "shrink-0 text-xs text-token-text-tertiary";
    right.textContent = d.isRunning ? "Running" : "Start";
    if (d.isRunning) right.style.color = "var(--color-token-success, #34c759)";
    item.append(left, right);
    item.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      pop.remove();
      await selectDevice(panel, api, d);
    });
    pop.appendChild(item);
  }
}

async function selectDevice(panel, api, device) {
  if (device.isRunning && device.serial) {
    setStatus(panel, `Active: ${device.name || device.serial}`);
    panel.__codexppAndroidEmuAttachCapture?.(device.serial);
    setDevicePickerLabel(panel, device.name || device.serial);
    return;
  }

  if (!device.avdName) {
    setStatus(panel, "Cannot start target without an AVD name.");
    return;
  }
  setStatus(panel, `Starting ${device.name || device.avdName}...`);
  const r = await api.ipc.invoke("android-emu:emulator", ["start", device.avdName]);
  if (!r?.ok) {
    setStatus(panel, "Start failed: " + (r?.error || "unknown"));
    return;
  }
  setStatus(panel, `Active: ${device.name || device.avdName}`);
  panel.__codexppAndroidEmuAttachCapture?.(r.serial);
  setDevicePickerLabel(panel, device.name || device.avdName);
}

async function ensureBootedDevice(panel, api) {
  const res = await api.ipc.invoke("android-emu:devices");
  if (!res?.ok) {
    setStatus(panel, "Android tooling unavailable: " + (res?.adbError || res?.emulatorError || ""));
    return null;
  }
  const devices = res.data?.devices || [];
  const running = devices.find((d) => d.isRunning && d.serial && d.type === "emulator");
  if (running) {
    setStatus(panel, `Active: ${running.name || running.serial}`);
    setDevicePickerLabel(panel, running.name || running.serial);
    return running.serial;
  }

  const pick =
    devices.find((d) => d.avdName && /Pixel[_ ]?9/i.test(d.avdName + " " + d.name)) ||
    devices.find((d) => d.avdName && /Pixel/i.test(d.avdName + " " + d.name)) ||
    devices.find((d) => d.avdName);
  if (!pick) {
    const fallback = devices.find((d) => d.isRunning && d.serial);
    if (fallback) {
      setStatus(panel, `Active: ${fallback.name || fallback.serial}`);
      setDevicePickerLabel(panel, fallback.name || fallback.serial);
      return fallback.serial;
    }
    setStatus(panel, "No Android AVDs are available.");
    return null;
  }

  setStatus(panel, `Starting ${pick.name || pick.avdName}...`);
  const r = await api.ipc.invoke("android-emu:emulator", ["start", pick.avdName]);
  if (!r?.ok) {
    setStatus(panel, "Start failed: " + (r?.error || "unknown"));
    return null;
  }
  setStatus(panel, `Active: ${pick.name || pick.avdName}`);
  setDevicePickerLabel(panel, pick.name || pick.avdName);
  return r.serial || null;
}

function makeDevicePickerButton(panel, api) {
  const b = document.createElement("button");
  b.type = "button";
  b.setAttribute(TWEAK_ATTR, "toolbar-button");
  b.dataset.codexppAndroidEmuRole = "device-picker";
  b.setAttribute("aria-label", "Choose Android target");
  b.setAttribute("title", "Choose Android target");
  const label = document.createElement("span");
  label.setAttribute(TWEAK_ATTR, "device-picker-label");
  label.textContent = "Device";
  label.style.maxWidth = "160px";
  label.style.overflow = "hidden";
  label.style.textOverflow = "ellipsis";
  label.style.whiteSpace = "nowrap";
  const chev = document.createElement("span");
  chev.className = "flex shrink-0 items-center justify-center";
  chev.innerHTML = SVGS.chevron;
  b.append(label, chev);
  b.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    openDevicePicker(panel, api).catch((err) =>
      api.log?.error?.("android-emu openDevicePicker threw", String(err)),
    );
  });
  return b;
}

async function refreshDeviceLabel(panel, api) {
  const res = await api.ipc.invoke("android-emu:devices");
  if (!res?.ok) return;
  const running = (res.data?.devices || []).find((d) => d.isRunning && d.serial);
  setDevicePickerLabel(panel, running ? running.name || running.serial : "Device");
}

function setDevicePickerLabel(panel, text) {
  const button = panel.__codexppAndroidEmuDevicePickerButton;
  const label = button?.querySelector(`[${TWEAK_ATTR}="device-picker-label"]`);
  if (label) label.textContent = text || "Device";
}

function setStatus(panel, msg) {
  const placeholder = panel?.__codexppAndroidEmuPlaceholder;
  if (!placeholder) return;
  let status = placeholder.querySelector(`[${TWEAK_ATTR}="status"]`);
  if (!status) {
    status = document.createElement("div");
    status.setAttribute(TWEAK_ATTR, "status");
    placeholder.appendChild(status);
  }
  status.textContent = msg;
}

// helpers

function extractLabel(node) {
  return node.getAttribute("aria-label")?.trim() || compactText(node.textContent || "");
}

function matchesBrowserText(value) {
  return BROWSER_PATTERNS.some((pattern) => pattern.test(value));
}

function compactText(value) {
  return value.replace(/\s+/g, " ").trim();
}

function htmlToElement(html) {
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}
