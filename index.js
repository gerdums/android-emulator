/**
 * co.gerdums.android-emulator
 *
 * Adds an "Android Emulator" tab to Codex's right-panel + menu.
 *
 * - Native-looking right-panel tab + panel, parallel-injected like the iOS
 *   simulator tweak.
 * - Headless emulator launch through the Android SDK emulator.
 * - Low-latency emulator capture through the emulator console screenshot API.
 * - Pointer input through a persistent `adb shell` so taps/drags do not pay
 *   an adb process startup cost per event.
 */

"use strict";

const TWEAK_ATTR = "data-codexpp-android-emu";
const OTHER_CUSTOM_PANEL_ATTRS = ["data-codexpp-ios-sim"];
const CUSTOM_PANEL_ATTRS = [TWEAK_ATTR, ...OTHER_CUSTOM_PANEL_ATTRS];
const CUSTOM_MENU_ATTRS = [TWEAK_ATTR, "data-codexpp-ios-sim"];
const CUSTOM_PANEL_PREV_DISPLAY_ATTR = "data-codexpp-custom-panel-prev-display";
const LEGACY_PANEL_PREV_DISPLAY_ATTRS = [
  "data-codexpp-android-emu-prev-display",
  "data-codexpp-ios-sim-prev-display",
];
const STYLE_ID = "codexpp-android-emu-style";
const MENU_LABEL = "Android Emulator";
const PANEL_LABEL = "Android Emulator";
const BROWSER_PATTERNS = [/^browser$/i, /^browser use$/i, /\bbrowser\b/i];
const PICKER_TITLE_PATTERNS = [/^new chat$/i, /^open file$/i, /^browse files$/i];
const FALLBACK_MENU_TEXT_PATTERNS = [
  /^\+?new chat\b/i,
  /^open file\b/i,
  /^browse files\b/i,
  /^terminal\b/i,
  /^review\b/i,
  /^settings\b/i,
];
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
        if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopImmediatePropagation?.();
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
      emuButton.addEventListener("pointerup", activate, true);
      emuButton.addEventListener("mouseup", activate, true);
      emuButton.addEventListener("click", activate, true);
      emuButton.addEventListener("keydown", activate, true);
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
  const http2 = require("node:http2");
  const net = require("node:net");
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
    captureMode: null,
    captureTimer: null,
    captureBusy: false,
    screenrecordProc: null,
    ffmpegProc: null,
    screencapProc: null,
    screenshotTimer: null,
    screenshotBusy: false,
    screenshotDir: null,
    captureConsole: null,
    captureConsoleSerial: null,
    grpcClient: null,
    grpcSerial: null,
    grpcPort: null,
    grpcToken: null,
    grpcTimer: null,
    grpcBusy: false,
    grpcFailures: 0,
    grpcStreamSize: null,
    inputConsole: null,
    inputConsoleSerial: null,
    captureRestartTimer: null,
    captureStopping: false,
    jpegBuffer: Buffer.alloc(0),
    pngBuffer: Buffer.alloc(0),
    lastFrameSentAt: 0,
    lastMeta: null,
    lastError: null,
    touch: null,
    inputShellProc: null,
    inputShellSerial: null,
    inputBusy: false,
    pendingMove: null,
    inputMoveTimer: null,
    displayCache: new Map(),
    emulatorProcs: new Map(),
  });
  state.grpcClient ??= null;
  state.grpcSerial ??= null;
  state.grpcPort ??= null;
  state.grpcToken ??= null;
  state.grpcTimer ??= null;
  state.grpcBusy ??= false;
  state.grpcFailures ??= 0;
  state.grpcStreamSize ??= null;

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
  const ffmpegPath = findTool("ffmpeg", []);

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

  function emulatorConsolePort(serial) {
    const match = String(serial || "").match(/^emulator-(\d+)$/);
    return match ? Number(match[1]) : null;
  }

  function emulatorConsoleAuthToken() {
    try {
      return fs.readFileSync(path.join(os.homedir(), ".emulator_console_auth_token"), "utf8").trim();
    } catch {
      return "";
    }
  }

  function createConsoleClient(serial, label) {
    const port = emulatorConsolePort(serial);
    const token = emulatorConsoleAuthToken();
    const client = {
      socket: null,
      ready: null,
      buffer: "",
      queue: [],
      closed: false,
    };

    const close = () => {
      client.closed = true;
      for (const item of client.queue.splice(0)) {
        clearTimeout(item.timer);
        item.resolve({ ok: false, error: `${label} console closed` });
      }
      if (client.socket && !client.socket.destroyed) {
        try {
          client.socket.end("quit\n");
        } catch {}
        try {
          client.socket.destroy();
        } catch {}
      }
      client.socket = null;
      client.ready = null;
    };

    const processBuffer = () => {
      if (!client.socket || client.closed) return;
      if (/Authentication required/i.test(client.buffer)) {
        if (!token) {
          close();
          return;
        }
        client.buffer = "";
        client.socket.write(`auth ${token}\n`);
        return;
      }
      if (client.ready?.resolve && /OK\r?\n/.test(client.buffer)) {
        const resolve = client.ready.resolve;
        clearTimeout(client.ready.timer);
        client.ready.resolve = null;
        client.buffer = "";
        resolve({ ok: true });
        return;
      }
      if (client.queue.length && /(OK|KO:.*)\r?\n/.test(client.buffer)) {
        const item = client.queue.shift();
        clearTimeout(item.timer);
        const text = client.buffer.trim();
        client.buffer = "";
        item.resolve(/^OK\b/.test(text) ? { ok: true, text } : { ok: false, error: text });
      }
    };

    const connect = () => {
      if (!port) return Promise.resolve({ ok: false, error: `Not an emulator serial: ${serial}` });
      if (client.socket && !client.socket.destroyed && client.ready && !client.ready.resolve) {
        return Promise.resolve({ ok: true });
      }
      if (client.ready?.promise) return client.ready.promise;

      client.closed = false;
      client.buffer = "";
      client.socket = net.createConnection(port, "127.0.0.1");
      client.socket.setEncoding("utf8");
      const ready = {};
      ready.promise = new Promise((resolve) => {
        const timer = setTimeout(() => {
          close();
          resolve({ ok: false, error: `${label} console connect timed out` });
        }, 2_000);
        ready.resolve = resolve;
        ready.timer = timer;
      });
      client.ready = ready;
      client.socket.on("data", (chunk) => {
        client.buffer += chunk;
        processBuffer();
      });
      client.socket.on("error", (e) => {
        api.log?.warn?.(`android-emu ${label} console error`, String(e));
        close();
      });
      client.socket.on("close", () => {
        if (!client.closed) close();
      });
      return client.ready.promise;
    };

    const command = async (commandText, timeoutMs = 1_500) => {
      const ready = await connect();
      if (!ready.ok) return ready;
      return new Promise((resolve) => {
        const item = {
          resolve,
          timer: setTimeout(() => {
            const idx = client.queue.indexOf(item);
            if (idx >= 0) client.queue.splice(idx, 1);
            resolve({ ok: false, error: `${label} console command timed out` });
          }, timeoutMs),
        };
        client.queue.push(item);
        try {
          client.socket.write(commandText + "\n");
        } catch (e) {
          clearTimeout(item.timer);
          client.queue.pop();
          resolve({ ok: false, error: String(e) });
        }
      });
    };

    return { command, close };
  }

  function getCaptureConsole(serial) {
    if (!state.captureConsole || state.captureConsoleSerial !== serial) {
      state.captureConsole?.close?.();
      state.captureConsole = createConsoleClient(serial, "capture");
      state.captureConsoleSerial = serial;
    }
    return state.captureConsole;
  }

  function getInputConsole(serial) {
    if (!state.inputConsole || state.inputConsoleSerial !== serial) {
      state.inputConsole?.close?.();
      state.inputConsole = createConsoleClient(serial, "input");
      state.inputConsoleSerial = serial;
    }
    return state.inputConsole;
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

  function targetStreamSize(size) {
    if (!size?.width || !size?.height) return { width: 540, height: 1200 };
    const targetWidth = Math.min(720, Math.max(360, Math.round(size.width / 2)));
    const width = targetWidth % 2 === 0 ? targetWidth : targetWidth - 1;
    const rawHeight = Math.round((width * size.height) / size.width);
    const height = rawHeight % 2 === 0 ? rawHeight : rawHeight + 1;
    return { width, height };
  }

  function targetGrpcStreamSize(size) {
    if (!size?.width || !size?.height) return { width: 540, height: 1200 };
    const width = Math.min(540, Math.max(360, Math.round(size.width / 2)));
    const height = Math.max(1, Math.round((width * size.height) / size.width));
    return { width, height };
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function encodeGrpcVarint(value) {
    let v = BigInt(value);
    const out = [];
    while (v >= 128n) {
      out.push(Number((v & 0x7fn) | 0x80n));
      v >>= 7n;
    }
    out.push(Number(v));
    return Buffer.from(out);
  }

  function encodeGrpcVarintField(field, value) {
    return Buffer.concat([encodeGrpcVarint((field << 3) | 0), encodeGrpcVarint(value)]);
  }

  function encodeGrpcFrame(payload) {
    const header = Buffer.alloc(5);
    header[0] = 0;
    header.writeUInt32BE(payload.length, 1);
    return Buffer.concat([header, payload]);
  }

  function encodeImageFormat(format, width, height) {
    return Buffer.concat([
      encodeGrpcVarintField(1, format),
      encodeGrpcVarintField(3, width),
      encodeGrpcVarintField(4, height),
    ]);
  }

  function readGrpcVarint(buffer, offset) {
    let shift = 0n;
    let value = 0n;
    let pos = offset;
    while (pos < buffer.length) {
      const byte = buffer[pos++];
      value |= BigInt(byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) return [Number(value), pos];
      shift += 7n;
    }
    return null;
  }

  function parseGrpcImageFormat(buffer) {
    const format = {};
    let pos = 0;
    while (pos < buffer.length) {
      const tag = readGrpcVarint(buffer, pos);
      if (!tag) break;
      pos = tag[1];
      const field = tag[0] >> 3;
      const wire = tag[0] & 7;
      if (wire === 0) {
        const value = readGrpcVarint(buffer, pos);
        if (!value) break;
        if (field === 1) format.format = value[0];
        else if (field === 3) format.width = value[0];
        else if (field === 4) format.height = value[0];
        pos = value[1];
      } else if (wire === 2) {
        const len = readGrpcVarint(buffer, pos);
        if (!len) break;
        pos = len[1] + len[0];
      } else if (wire === 1) {
        pos += 8;
      } else if (wire === 5) {
        pos += 4;
      } else {
        break;
      }
    }
    return format;
  }

  function parseGrpcImage(buffer) {
    const result = { format: null, image: null, seq: null };
    let pos = 0;
    while (pos < buffer.length) {
      const tag = readGrpcVarint(buffer, pos);
      if (!tag) break;
      pos = tag[1];
      const field = tag[0] >> 3;
      const wire = tag[0] & 7;
      if (wire === 0) {
        const value = readGrpcVarint(buffer, pos);
        if (!value) break;
        if (field === 5) result.seq = value[0];
        pos = value[1];
      } else if (wire === 2) {
        const len = readGrpcVarint(buffer, pos);
        if (!len) break;
        pos = len[1];
        const end = pos + len[0];
        if (field === 1) result.format = parseGrpcImageFormat(buffer.subarray(pos, end));
        else if (field === 4) result.image = Buffer.from(buffer.subarray(pos, end));
        pos = end;
      } else if (wire === 1) {
        pos += 8;
      } else if (wire === 5) {
        pos += 4;
      } else {
        break;
      }
    }
    return result;
  }

  function parseIni(text) {
    const out = {};
    for (const raw of String(text || "").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq < 0) continue;
      out[line.slice(0, eq)] = line.slice(eq + 1).replace(/^"(.*)"$/, "$1");
    }
    return out;
  }

  function grpcDiscoveryDirs() {
    return [
      path.join(os.homedir(), "Library", "Caches", "TemporaryItems", "avd", "running"),
      path.join(os.tmpdir(), "avd", "running"),
      path.join(os.homedir(), ".android", "avd", "running"),
    ];
  }

  function findGrpcDiscovery(serial, port) {
    const consolePort = emulatorConsolePort(serial);
    for (const dir of grpcDiscoveryDirs()) {
      let entries = [];
      try {
        entries = fs.readdirSync(dir);
      } catch {
        continue;
      }
      for (const name of entries) {
        if (!/^pid_.*\.ini$/.test(name)) continue;
        const full = path.join(dir, name);
        let info;
        try {
          info = parseIni(fs.readFileSync(full, "utf8"));
        } catch {
          continue;
        }
        if (consolePort && Number(info["port.serial"]) !== consolePort) continue;
        if (port && Number(info["grpc.port"]) !== port) continue;
        if (info["grpc.token"] && info["grpc.port"]) return info;
      }
    }
    return null;
  }

  function closeGrpcClient() {
    const client = state.grpcClient;
    state.grpcClient = null;
    state.grpcSerial = null;
    state.grpcPort = null;
    state.grpcToken = null;
    if (client) {
      try {
        client.close();
      } catch {}
      try {
        client.destroy();
      } catch {}
    }
  }

  async function ensureGrpcEndpoint(serial) {
    const consolePort = emulatorConsolePort(serial);
    if (!consolePort) return { ok: false, error: "not an emulator serial" };
    const port = consolePort + 3000;
    if (state.grpcSerial === serial && state.grpcPort === port && state.grpcToken) {
      return { ok: true, port, token: state.grpcToken };
    }

    let started = await getCaptureConsole(serial).command(`grpc ${port}`, 1_000);
    if (!started.ok) {
      started = await run(adbPath, ["-s", serial, "emu", "grpc", String(port)], {
        timeoutMs: 1_000,
      });
    }
    if (!started.ok) {
      return { ok: false, error: started.stderr || started.error || "gRPC endpoint unavailable" };
    }

    let info = null;
    for (let i = 0; i < 6; i += 1) {
      info = findGrpcDiscovery(serial, port);
      if (info?.["grpc.token"]) break;
      await delay(50);
    }
    if (!info?.["grpc.token"]) return { ok: false, error: "gRPC token not found" };
    state.grpcSerial = serial;
    state.grpcPort = port;
    state.grpcToken = info["grpc.token"];
    return { ok: true, port, token: state.grpcToken };
  }

  function ensureGrpcClient(serial, endpoint) {
    if (
      state.grpcClient &&
      state.grpcSerial === serial &&
      state.grpcPort === endpoint.port &&
      !state.grpcClient.destroyed
    ) {
      return state.grpcClient;
    }
    closeGrpcClient();
    const client = http2.connect(`http://127.0.0.1:${endpoint.port}`);
    client.on("error", (e) => api.log?.warn?.("android-emu gRPC client error", String(e)));
    state.grpcClient = client;
    state.grpcSerial = serial;
    state.grpcPort = endpoint.port;
    state.grpcToken = endpoint.token;
    return client;
  }

  function grpcUnary(serial, endpoint, method, payload, timeoutMs = 1_000) {
    return new Promise((resolve) => {
      const client = ensureGrpcClient(serial, endpoint);
      const request = client.request({
        ":method": "POST",
        ":path": `/android.emulation.control.EmulatorController/${method}`,
        "content-type": "application/grpc",
        te: "trailers",
        authorization: `Bearer ${endpoint.token}`,
      });
      let settled = false;
      let buffer = Buffer.alloc(0);
      let response = null;
      let headerError = null;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try {
          request.close();
        } catch {}
        resolve(result);
      };
      const timer = setTimeout(() => finish({ ok: false, error: "gRPC request timed out" }), timeoutMs);
      timer.unref?.();

      request.on("response", (headers) => {
        const status = headers["grpc-status"];
        if (status && status !== "0") headerError = headers["grpc-message"] || `gRPC status ${status}`;
      });
      request.on("trailers", (headers) => {
        const status = headers["grpc-status"];
        if (status && status !== "0") headerError = headers["grpc-message"] || `gRPC status ${status}`;
      });
      request.on("data", (chunk) => {
        buffer = buffer.length ? Buffer.concat([buffer, chunk]) : chunk;
        while (buffer.length >= 5) {
          const len = buffer.readUInt32BE(1);
          if (buffer.length < 5 + len) break;
          response = Buffer.from(buffer.subarray(5, 5 + len));
          buffer = buffer.subarray(5 + len);
        }
      });
      request.on("error", (e) => {
        closeGrpcClient();
        finish({ ok: false, error: String(e) });
      });
      request.on("close", () => {
        if (response) finish({ ok: true, data: response });
        else finish({ ok: false, error: headerError || "empty gRPC response" });
      });
      request.end(encodeGrpcFrame(payload));
    });
  }

  function findJpegEnd(buffer, start) {
    for (let i = start + 2; i < buffer.length - 1; i += 1) {
      if (buffer[i] === 0xff && buffer[i + 1] === 0xd9) return i + 2;
    }
    return -1;
  }

  function processJpegStream(chunk) {
    state.jpegBuffer = state.jpegBuffer.length ? Buffer.concat([state.jpegBuffer, chunk]) : chunk;
    for (;;) {
      let start = -1;
      for (let i = 0; i < state.jpegBuffer.length - 1; i += 1) {
        if (state.jpegBuffer[i] === 0xff && state.jpegBuffer[i + 1] === 0xd8) {
          start = i;
          break;
        }
      }
      if (start < 0) {
        if (state.jpegBuffer.length > 1_000_000) state.jpegBuffer = Buffer.alloc(0);
        return;
      }
      if (start > 0) state.jpegBuffer = state.jpegBuffer.subarray(start);
      const end = findJpegEnd(state.jpegBuffer, 0);
      if (end < 0) {
        if (state.jpegBuffer.length > 8_000_000) state.jpegBuffer = Buffer.alloc(0);
        return;
      }
      const frame = Buffer.from(state.jpegBuffer.subarray(0, end));
      state.jpegBuffer = state.jpegBuffer.subarray(end);
      const now = Date.now();
      if (now - state.lastFrameSentAt < 45) continue;
      state.lastFrameSentAt = now;
      broadcast(FRAME_CHANNEL, frame);
    }
  }

  function processPngStream(chunk) {
    state.pngBuffer = state.pngBuffer.length ? Buffer.concat([state.pngBuffer, chunk]) : chunk;
    for (;;) {
      let start = -1;
      for (let i = 0; i < state.pngBuffer.length - 7; i += 1) {
        if (
          state.pngBuffer[i] === 0x89 &&
          state.pngBuffer[i + 1] === 0x50 &&
          state.pngBuffer[i + 2] === 0x4e &&
          state.pngBuffer[i + 3] === 0x47
        ) {
          start = i;
          break;
        }
      }
      if (start < 0) {
        if (state.pngBuffer.length > 1_000_000) state.pngBuffer = Buffer.alloc(0);
        return;
      }
      if (start > 0) state.pngBuffer = state.pngBuffer.subarray(start);
      let end = -1;
      for (let i = 8; i < state.pngBuffer.length - 7; i += 1) {
        if (
          state.pngBuffer[i] === 0x49 &&
          state.pngBuffer[i + 1] === 0x45 &&
          state.pngBuffer[i + 2] === 0x4e &&
          state.pngBuffer[i + 3] === 0x44 &&
          state.pngBuffer[i + 4] === 0xae &&
          state.pngBuffer[i + 5] === 0x42 &&
          state.pngBuffer[i + 6] === 0x60 &&
          state.pngBuffer[i + 7] === 0x82
        ) {
          end = i + 8;
          break;
        }
      }
      if (end < 0) {
        if (state.pngBuffer.length > 10_000_000) state.pngBuffer = Buffer.alloc(0);
        return;
      }
      const frame = Buffer.from(state.pngBuffer.subarray(0, end));
      state.pngBuffer = state.pngBuffer.subarray(end);
      const now = Date.now();
      if (now - state.lastFrameSentAt < 65) continue;
      state.lastFrameSentAt = now;
      broadcast(FRAME_CHANNEL, frame);
    }
  }

  function screenshotDirForSerial(serial) {
    const safe = String(serial || "android").replace(/[^A-Za-z0-9_.-]/g, "_");
    const dir = path.join(os.tmpdir(), "codexpp-android-emulator", safe);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  function latestPng(dir) {
    let latest = null;
    for (const name of fs.readdirSync(dir)) {
      if (!/\.png$/i.test(name)) continue;
      const full = path.join(dir, name);
      let st;
      try {
        st = fs.statSync(full);
      } catch {
        continue;
      }
      if (!latest || st.mtimeMs > latest.mtimeMs) latest = { full, mtimeMs: st.mtimeMs };
    }
    return latest?.full || null;
  }

  function cleanupScreenshotDir(dir, keepPath) {
    try {
      for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        if (full !== keepPath && /\.png$/i.test(name)) fs.rmSync(full, { force: true });
      }
    } catch {}
  }

  async function captureConsoleScreenshotOnce(serial) {
    if (!state.screenshotDir) state.screenshotDir = screenshotDirForSerial(serial);
    const consoleClient = getCaptureConsole(serial);
    let r = await consoleClient.command(`screenrecord screenshot ${state.screenshotDir}`, 1_500);
    if (!r.ok) {
      r = await run(adbPath, ["-s", serial, "emu", "screenrecord", "screenshot", state.screenshotDir], {
        timeoutMs: 1_500,
      });
    }
    if (!r.ok) {
      const error = r.stderr || r.error || "emulator screenshot failed";
      if (state.lastError !== error) {
        state.lastError = error;
        sendStatus({ kind: "error", error });
      }
      return false;
    }
    const file = latestPng(state.screenshotDir);
    if (!file) return false;
    const png = fs.readFileSync(file);
    state.lastError = null;
    broadcast(FRAME_CHANNEL, png);
    cleanupScreenshotDir(state.screenshotDir, file);
    return true;
  }

  async function captureGrpcScreenshotOnce(serial) {
    const endpoint = await ensureGrpcEndpoint(serial);
    if (!endpoint.ok) {
      const error = endpoint.error || "gRPC endpoint unavailable";
      if (state.lastError !== error) {
        state.lastError = error;
        sendStatus({ kind: "error", error });
      }
      return false;
    }

    const streamSize = state.grpcStreamSize || { width: 540, height: 1200 };
    const res = await grpcUnary(
      serial,
      endpoint,
      "getScreenshot",
      encodeImageFormat(0, streamSize.width, streamSize.height),
      900,
    );
    if (!res.ok) {
      closeGrpcClient();
      const error = res.error || "gRPC screenshot failed";
      if (state.lastError !== error) {
        state.lastError = error;
        sendStatus({ kind: "error", error });
      }
      return false;
    }

    const image = parseGrpcImage(res.data);
    if (!image.image?.length) return false;
    state.lastError = null;
    state.grpcFailures = 0;
    broadcast(FRAME_CHANNEL, image.image);

    const format = image.format || {};
    if (format.width && format.height) {
      const current = state.lastMeta || {};
      if (
        current.mode !== "grpc-png" ||
        current.streamWidth !== format.width ||
        current.streamHeight !== format.height
      ) {
        state.lastMeta = {
          ...current,
          serial,
          streamWidth: format.width,
          streamHeight: format.height,
          mode: "grpc-png",
        };
        broadcast(META_CHANNEL, state.lastMeta);
      }
    }
    return true;
  }

  async function startGrpcPngCapture(serial) {
    const endpoint = await ensureGrpcEndpoint(serial);
    if (!endpoint.ok) return endpoint;

    state.serial = serial;
    state.captureMode = "grpc-png";
    state.captureStopping = false;
    state.grpcFailures = 0;
    state.lastFrameSentAt = 0;
    const size = await getDisplaySize(serial).catch(() => ({ width: 1080, height: 2400 }));
    const streamSize = targetGrpcStreamSize(size);
    state.grpcStreamSize = streamSize;
    state.lastMeta = {
      serial,
      width: size.width,
      height: size.height,
      streamWidth: streamSize.width,
      streamHeight: streamSize.height,
      mode: "grpc-png",
    };
    broadcast(META_CHANNEL, state.lastMeta);
    sendStatus({ kind: "starting", message: "Starting emulator gRPC stream..." });

    const tick = async () => {
      if (state.captureMode !== "grpc-png" || state.captureStopping) return;
      const started = Date.now();
      if (!state.grpcBusy) {
        state.grpcBusy = true;
        try {
          const ok = await captureGrpcScreenshotOnce(serial);
          if (!ok) state.grpcFailures += 1;
        } catch (e) {
          state.grpcFailures += 1;
          sendStatus({ kind: "error", error: String(e) });
        } finally {
          state.grpcBusy = false;
        }
      }

      if (state.captureMode !== "grpc-png" || state.captureStopping) return;
      if (state.grpcFailures >= 5) {
        api.log?.warn?.("android-emu gRPC stream failed repeatedly; falling back to console screenshots");
        if (state.grpcTimer) {
          clearTimeout(state.grpcTimer);
          state.grpcTimer = null;
        }
        state.captureMode = null;
        closeGrpcClient();
        startConsoleScreenshotCapture(serial).catch((e) =>
          sendStatus({ kind: "error", error: String(e) }),
        );
        return;
      }

      const elapsed = Date.now() - started;
      state.grpcTimer = setTimeout(tick, Math.max(1, 33 - elapsed));
      state.grpcTimer.unref?.();
    };
    tick();
    return { ok: true, status: "started", mode: "grpc-png", serial };
  }

  async function startConsoleScreenshotCapture(serial) {
    state.serial = serial;
    state.captureMode = "emulator-screenshot";
    state.screenshotDir = screenshotDirForSerial(serial);
    state.lastFrameSentAt = 0;
    const size = await getDisplaySize(serial).catch(() => ({ width: 1080, height: 2400 }));
    state.lastMeta = { serial, width: size.width, height: size.height, mode: "emulator-screenshot" };
    broadcast(META_CHANNEL, state.lastMeta);
    sendStatus({ kind: "starting", message: "Starting emulator screenshot stream..." });

    const tick = async () => {
      if (state.captureMode !== "emulator-screenshot" || state.captureStopping) return;
      const started = Date.now();
      if (!state.screenshotBusy) {
        state.screenshotBusy = true;
        try {
          await captureConsoleScreenshotOnce(serial);
        } catch (e) {
          sendStatus({ kind: "error", error: String(e) });
        } finally {
          state.screenshotBusy = false;
        }
      }
      if (state.captureMode !== "emulator-screenshot" || state.captureStopping) return;
      const elapsed = Date.now() - started;
      state.screenshotTimer = setTimeout(tick, Math.max(1, 75 - elapsed));
      state.screenshotTimer.unref?.();
    };
    tick();
    return { ok: true, status: "started", mode: "emulator-screenshot", serial };
  }

  async function startScreencapLoopCapture(serial, reason) {
    state.serial = serial;
    state.captureMode = "screencap-loop";
    state.pngBuffer = Buffer.alloc(0);
    state.lastFrameSentAt = 0;
    const size = await getDisplaySize(serial).catch(() => ({ width: 1080, height: 2400 }));
    state.lastMeta = { serial, width: size.width, height: size.height, mode: "screencap-loop" };
    broadcast(META_CHANNEL, state.lastMeta);
    sendStatus({
      kind: "starting",
      message: reason ? "Falling back to adb screencap stream..." : "Starting Android capture...",
    });

    const proc = spawn(adbPath, ["-s", serial, "exec-out", "sh", "-c", "while true; do screencap -p; done"], {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    state.screencapProc = proc;
    proc.stdout.on("data", processPngStream);
    proc.stderr.on("data", (b) => {
      const line = b.toString("utf8").trim();
      if (line) api.log?.info?.("[android-screencap]", line);
    });
    proc.on("error", (e) => {
      if (state.captureStopping) return;
      sendStatus({ kind: "error", error: String(e) });
    });
    proc.on("exit", (code, signal) => {
      if (state.captureStopping || state.captureMode !== "screencap-loop") return;
      sendStatus({ kind: "stopped", reason: `screencap exited ${code ?? signal ?? ""}`.trim() });
      state.screencapProc = null;
      state.captureMode = null;
    });
    return { ok: true, status: "started", mode: "screencap-loop", serial };
  }

  async function startStreamCapture(serial) {
    const size = await getDisplaySize(serial).catch(() => ({ width: 1080, height: 2400 }));
    const streamSize = targetStreamSize(size);
    state.lastMeta = {
      serial,
      width: size.width,
      height: size.height,
      streamWidth: streamSize.width,
      streamHeight: streamSize.height,
      mode: "screenrecord",
    };
    broadcast(META_CHANNEL, state.lastMeta);

    state.captureStopping = false;
    state.jpegBuffer = Buffer.alloc(0);
    state.lastFrameSentAt = 0;
    sendStatus({ kind: "starting", message: "Starting low-latency Android stream..." });

    const adbArgs = [
      "-s", serial,
      "exec-out",
      "screenrecord",
      "--output-format=h264",
      "--bit-rate", "2500000",
      "--size", `${streamSize.width}x${streamSize.height}`,
      "--time-limit", "180",
      "-",
    ];
    const ffmpegArgs = [
      "-hide_banner",
      "-loglevel", "error",
      "-fflags", "+genpts",
      "-r", "25",
      "-f", "h264",
      "-i", "pipe:0",
      "-f", "image2pipe",
      "-c:v", "mjpeg",
      "-q:v", "6",
      "pipe:1",
    ];

    const adbProc = spawn(adbPath, adbArgs, { stdio: ["ignore", "pipe", "pipe"], env: process.env });
    const ffmpegProc = spawn(ffmpegPath, ffmpegArgs, { stdio: ["pipe", "pipe", "pipe"], env: process.env });
    state.screenrecordProc = adbProc;
    state.ffmpegProc = ffmpegProc;
    state.captureMode = "screenrecord";

    adbProc.stdout.pipe(ffmpegProc.stdin);
    adbProc.stdout.on("error", () => {});
    ffmpegProc.stdin.on("error", () => {});
    adbProc.stderr.on("data", (b) => {
      const line = b.toString("utf8").trim();
      if (line) api.log?.info?.("[android-screenrecord]", line);
    });
    ffmpegProc.stderr.on("data", (b) => {
      const line = b.toString("utf8").trim();
      if (line) api.log?.info?.("[android-ffmpeg]", line);
    });
    ffmpegProc.stdout.on("data", processJpegStream);

    const failToPolling = (source, err) => {
      if (state.captureStopping) return;
      api.log?.warn?.("android-emu stream failed", { source, error: String(err || "") });
      stopStreamCapture();
      startPollingCapture(serial, "stream-fallback").catch((e) =>
        sendStatus({ kind: "error", error: String(e) }),
      );
    };

    adbProc.on("error", (e) => failToPolling("adb", e));
    ffmpegProc.on("error", (e) => failToPolling("ffmpeg", e));
    adbProc.on("exit", (code, signal) => {
      if (state.captureStopping) return;
      api.log?.info?.("android-emu screenrecord exit", { code, signal });
      scheduleStreamRestart(serial);
    });
    ffmpegProc.on("exit", (code, signal) => {
      if (state.captureStopping) return;
      api.log?.info?.("android-emu ffmpeg exit", { code, signal });
      scheduleStreamRestart(serial);
    });

    return { ok: true, status: "started", mode: "screenrecord", serial };
  }

  function scheduleStreamRestart(serial) {
    if (state.captureRestartTimer || state.captureMode !== "screenrecord") return;
    state.captureRestartTimer = setTimeout(() => {
      state.captureRestartTimer = null;
      if (state.captureStopping || state.captureMode !== "screenrecord") return;
      stopStreamCapture({ keepMode: true });
      startStreamCapture(serial).catch((e) => {
        api.log?.warn?.("android-emu stream restart failed", String(e));
        startPollingCapture(serial, "stream-restart-fallback").catch(() => {});
      });
    }, 400);
    state.captureRestartTimer.unref?.();
  }

  async function startPollingCapture(serial, reason) {
    state.serial = serial;
    state.captureMode = "polling";
    if (state.captureTimer) return { ok: true, status: "already-running", mode: "polling", serial };
    sendStatus({
      kind: "starting",
      message: reason ? "Falling back to screencap polling..." : "Starting Android capture...",
    });
    state.captureTimer = setInterval(() => captureOnce(), 250);
    state.captureTimer.unref?.();
    captureOnce();
    return { ok: true, status: "started", mode: "polling", serial };
  }

  function stopStreamCapture(opts = {}) {
    state.captureStopping = true;
    if (state.captureRestartTimer) {
      clearTimeout(state.captureRestartTimer);
      state.captureRestartTimer = null;
    }
    const procs = [state.screenrecordProc, state.ffmpegProc];
    state.screenrecordProc = null;
    state.ffmpegProc = null;
    state.jpegBuffer = Buffer.alloc(0);
    for (const proc of procs) {
      if (!proc || proc.killed) continue;
      try {
        proc.removeAllListeners("exit");
        proc.removeAllListeners("error");
        proc.kill("SIGTERM");
      } catch {}
    }
    if (!opts.keepMode && state.captureMode === "screenrecord") state.captureMode = null;
    state.captureStopping = false;
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
    if (state.captureMode === "screenrecord" && state.screenrecordProc && state.ffmpegProc) {
      return { ok: true, status: "already-running", mode: "screenrecord", serial: state.serial };
    }
    if (state.captureMode === "emulator-screenshot") {
      return { ok: true, status: "already-running", mode: "emulator-screenshot", serial: state.serial };
    }
    if (state.captureMode === "grpc-png") {
      return { ok: true, status: "already-running", mode: "grpc-png", serial: state.serial };
    }
    if (state.captureMode === "screencap-loop" && state.screencapProc) {
      return { ok: true, status: "already-running", mode: "screencap-loop", serial: state.serial };
    }
    if (state.captureTimer) {
      return { ok: true, status: "already-running", mode: "polling", serial: state.serial };
    }
    if (/^emulator-\d+$/.test(state.serial)) {
      const grpc = await startGrpcPngCapture(state.serial).catch((e) => ({
        ok: false,
        error: String(e),
      }));
      if (grpc?.ok) return grpc;
      api.log?.warn?.("android-emu gRPC capture unavailable; falling back to console screenshots", grpc?.error);
      return startConsoleScreenshotCapture(state.serial);
    }
    return startScreencapLoopCapture(state.serial);
  }

  function stopCapture(reason) {
    stopStreamCapture();
    state.captureConsole?.close?.();
    state.captureConsole = null;
    state.captureConsoleSerial = null;
    if (state.screencapProc && !state.screencapProc.killed) {
      try {
        state.screencapProc.removeAllListeners("exit");
        state.screencapProc.removeAllListeners("error");
        state.screencapProc.kill("SIGTERM");
      } catch {}
    }
    state.screencapProc = null;
    state.pngBuffer = Buffer.alloc(0);
    if (state.screenshotTimer) {
      clearTimeout(state.screenshotTimer);
      state.screenshotTimer = null;
    }
    if (state.grpcTimer) {
      clearTimeout(state.grpcTimer);
      state.grpcTimer = null;
    }
    state.screenshotBusy = false;
    state.grpcBusy = false;
    state.grpcFailures = 0;
    state.grpcStreamSize = null;
    closeGrpcClient();
    if (state.captureTimer) {
      clearInterval(state.captureTimer);
      state.captureTimer = null;
    }
    state.captureBusy = false;
    state.captureMode = null;
    if (reason) sendStatus({ kind: "stopped", reason });
  }

  function stopInputShell() {
    if (state.inputMoveTimer) {
      clearTimeout(state.inputMoveTimer);
      state.inputMoveTimer = null;
    }
    state.pendingMove = null;
    state.touch = null;
    state.inputConsole?.close?.();
    state.inputConsole = null;
    state.inputConsoleSerial = null;
    const proc = state.inputShellProc;
    state.inputShellProc = null;
    state.inputShellSerial = null;
    if (proc && !proc.killed) {
      try {
        proc.kill("SIGTERM");
      } catch {}
    }
  }

  function ensureInputShell(serial) {
    if (state.inputShellProc && !state.inputShellProc.killed && state.inputShellSerial === serial) {
      return { ok: true };
    }
    stopInputShell();
    const proc = spawn(adbPath, ["-s", serial, "shell"], {
      stdio: ["pipe", "ignore", "pipe"],
      env: process.env,
    });
    proc.stderr.on("data", (b) => {
      const line = b.toString("utf8").trim();
      if (line) api.log?.info?.("[android-input]", line);
    });
    proc.on("error", (e) => {
      api.log?.warn?.("android-emu input shell error", String(e));
      if (state.inputShellProc === proc) stopInputShell();
    });
    proc.on("exit", (code, signal) => {
      api.log?.info?.("android-emu input shell exit", { code, signal });
      if (state.inputShellProc === proc) {
        state.inputShellProc = null;
        state.inputShellSerial = null;
      }
    });
    state.inputShellProc = proc;
    state.inputShellSerial = serial;
    return { ok: true };
  }

  function safeInputArgs(args) {
    return args.map((arg) => String(arg).replace(/[^A-Za-z0-9_.:-]/g, ""));
  }

  async function runShellInput(serial, args) {
    const ready = ensureInputShell(serial);
    if (!ready.ok) return ready;
    try {
      state.inputShellProc.stdin.write("input " + safeInputArgs(args).join(" ") + "\n");
      return { ok: true };
    } catch (e) {
      stopInputShell();
      return { ok: false, error: String(e) };
    }
  }

  function pointDistance(a, b) {
    if (!a || !b) return Infinity;
    return Math.hypot((b.x || 0) - (a.x || 0), (b.y || 0) - (a.y || 0));
  }

  function schedulePendingMove(serial) {
    if (state.inputMoveTimer) return;
    const delayMs = /^emulator-\d+$/.test(serial) ? 16 : 35;
    state.inputMoveTimer = setTimeout(() => {
      state.inputMoveTimer = null;
      const pending = state.pendingMove;
      state.pendingMove = null;
      if (pending && state.touch) {
        if (/^emulator-\d+$/.test(serial)) {
          state.touch.last = pending;
          state.touch.lastSent = pending;
          state.touch.lastMoveAt = Date.now();
          state.touch.moved = true;
          sendEmulatorMouse(serial, pending, true).catch((e) =>
            api.log?.warn?.("android-emu pending mouse failed", String(e)),
          );
        } else {
          sendMoveSegment(serial, pending).catch((e) =>
            api.log?.warn?.("android-emu pending move failed", String(e)),
          );
        }
      }
    }, delayMs);
    state.inputMoveTimer.unref?.();
  }

  async function sendMoveSegment(serial, point) {
    const touch = state.touch;
    if (!touch) return { ok: true };
    const from = touch.lastSent || touch.start;
    if (pointDistance(from, point) < 8) return { ok: true };
    const now = Date.now();
    if (now - (touch.lastMoveAt || 0) < 35) {
      state.pendingMove = point;
      schedulePendingMove(serial);
      return { ok: true, throttled: true };
    }
    touch.lastSent = point;
    touch.lastMoveAt = now;
    touch.moved = true;
    return runShellInput(serial, ["swipe", from.x, from.y, point.x, point.y, 45]);
  }

  async function sendEmulatorMouse(serial, point, pressed) {
    const result = await getInputConsole(serial).command(
      `event mouse ${point.x} ${point.y} 0 ${pressed ? 1 : 0}`,
      500,
    );
    return result.ok ? result : runShellInput(serial, ["tap", point.x, point.y]);
  }

  async function handleEmulatorTouch(serial, event, point) {
    const now = Date.now();
    if (event.phase === "down") {
      state.touch = { start: point, last: point, lastSent: point, lastMoveAt: now, moved: false };
      state.pendingMove = null;
      return sendEmulatorMouse(serial, point, true);
    }
    if (event.phase === "move") {
      if (!state.touch) return { ok: true };
      if (pointDistance(state.touch.lastSent, point) < 4) return { ok: true };
      if (now - (state.touch.lastMoveAt || 0) < 16) {
        state.pendingMove = point;
        schedulePendingMove(serial);
        return { ok: true, throttled: true };
      }
      state.touch.last = point;
      state.touch.lastSent = point;
      state.touch.lastMoveAt = now;
      state.touch.moved = true;
      return sendEmulatorMouse(serial, point, true);
    }
    if (event.phase === "up") {
      state.touch = null;
      state.pendingMove = null;
      if (state.inputMoveTimer) {
        clearTimeout(state.inputMoveTimer);
        state.inputMoveTimer = null;
      }
      return sendEmulatorMouse(serial, point, false);
    }
    return { ok: true };
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

    if (/^emulator-\d+$/.test(serial)) {
      return handleEmulatorTouch(serial, event, point);
    }

    if (event.phase === "down") {
      state.touch = { start: point, last: point, lastSent: point, lastMoveAt: 0, moved: false };
      state.pendingMove = null;
      return { ok: true };
    }
    if (event.phase === "move") {
      if (state.touch) state.touch.last = point;
      return sendMoveSegment(serial, point);
    }
    if (event.phase === "up") {
      const start = state.touch?.start || point;
      const lastSent = state.touch?.lastSent || start;
      const moved = state.touch?.moved || pointDistance(start, point) >= 12;
      state.touch = null;
      state.pendingMove = null;
      if (state.inputMoveTimer) {
        clearTimeout(state.inputMoveTimer);
        state.inputMoveTimer = null;
      }
      const dx = point.x - start.x;
      const dy = point.y - start.y;
      const distance = Math.hypot(dx, dy);
      if (!moved && distance < 12) {
        const r = await runShellInput(serial, ["tap", point.x, point.y]);
        return { ok: r.ok, error: r.stderr || r.error };
      }
      const r = pointDistance(lastSent, point) >= 6
        ? await runShellInput(serial, ["swipe", lastSent.x, lastSent.y, point.x, point.y, 45])
        : { ok: true };
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
    stopInputShell();
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
    if (!isVisibleElement(node)) continue;
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
      if (!isVisibleElement(row)) continue;
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

  if (found.size === 0) {
    for (const fallback of findFallbackMenuButtons()) found.add(fallback);
  }

  return Array.from(found);
}

function findFallbackMenuButtons() {
  const found = new Set();
  const roots = Array.from(
    document.querySelectorAll(
      '[role="menu"], [data-radix-popper-content-wrapper], [data-side][data-align], [role="dialog"]',
    ),
  );

  for (const root of roots) {
    if (!(root instanceof HTMLElement)) continue;
    if (!isVisibleElement(root)) continue;
    const candidates = Array.from(
      root.querySelectorAll('[role="menuitem"], button, [role="button"]'),
    ).filter(isFallbackMenuCandidate);
    if (!candidates.length) continue;
    const preferred =
      candidates.find((node) =>
        FALLBACK_MENU_TEXT_PATTERNS.some((pattern) => pattern.test(extractLabel(node))),
      ) || candidates[0];
    found.add(preferred);
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

function isFallbackMenuCandidate(node) {
  if (!(node instanceof HTMLElement)) return false;
  if (isCustomMenuEntry(node)) return false;
  if (!isMenuCandidate(node)) return false;
  if (!isVisibleElement(node)) return false;
  if (node.matches("[disabled]") || node.getAttribute("aria-disabled") === "true") return false;
  const text = extractLabel(node);
  if (/^(close|dismiss|cancel|back)$/i.test(text)) return false;
  return Boolean(text || node.querySelector("svg"));
}

function isCustomMenuEntry(node) {
  return CUSTOM_MENU_ATTRS.some((attr) => Boolean(node.closest(`[${attr}]`)));
}

function isVisibleElement(node) {
  const style = window.getComputedStyle?.(node);
  if (style && (style.display === "none" || style.visibility === "hidden")) return false;
  return node.getClientRects().length > 0;
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
  if (setTitle) {
    removeShortcutHints(button);
    return;
  }

  let setFallbackTitle = false;
  const isPickerRow = Boolean(button.closest('[role="dialog"]'));
  for (const node of textNodes) {
    const text = compactText(node.nodeValue || "");
    if (!isRewriteableMenuText(text)) continue;
    if (!setFallbackTitle) {
      node.nodeValue = MENU_LABEL;
      setFallbackTitle = true;
      if (!isPickerRow) break;
      continue;
    }
    node.nodeValue = PICKER_SUBTITLE;
    break;
  }
  if (setFallbackTitle) {
    removeShortcutHints(button);
    return;
  }

  const label = document.createElement("span");
  label.textContent = MENU_LABEL;
  button.appendChild(label);
  removeShortcutHints(button);
}

function isRewriteableMenuText(text) {
  if (!text || text === MENU_LABEL) return false;
  if (/^[⌘⇧⌥⌃^]+/.test(text) || /Cmd|Ctrl|Alt|Shift|⌘/.test(text)) return false;
  if (!/[A-Za-z]/.test(text)) return false;
  return true;
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
  retryMountEmuPanel(api, Date.now());
}

function retryMountEmuPanel(api, startedAt) {
  setTimeout(() => {
    let mounted = false;
    try {
      mounted = mountEmuPanel(api);
    } catch (err) {
      api?.log?.error?.("android-emu mountEmuPanel threw", String(err?.stack || err));
    }
    if (mounted) return;
    if (Date.now() - startedAt < 2500) {
      ensureSidePanelVisible();
      retryMountEmuPanel(api, startedAt);
      return;
    }
    api?.log?.warn?.("android-emu could not find side panel host");
  }, 80);
}

function mountEmuPanel(api) {
  const tablist = findRightTablist();
  if (!(tablist instanceof HTMLElement)) return false;
  const panelHost = findPanelHostForTablist(tablist);
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
    const tablist = controller.closest('[role="tablist"]');
    const panelHost =
      tablist instanceof HTMLElement ? findPanelHostForTablist(tablist) : null;
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
  const tablist = findRightTablist();
  const panelHost =
    tablist instanceof HTMLElement ? findPanelHostForTablist(tablist) : null;
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

  const mirror = document.createElement("canvas");
  mirror.setAttribute("role", "img");
  mirror.setAttribute("aria-label", "Android Emulator");
  mirror.width = 1;
  mirror.height = 1;
  mirror.draggable = false;
  mirror.style.maxWidth = "100%";
  mirror.style.maxHeight = "100%";
  mirror.style.width = "auto";
  mirror.style.height = "auto";
  mirror.style.aspectRatio = "1 / 1";
  mirror.style.display = "none";
  mirror.style.userSelect = "none";
  mirror.style.touchAction = "none";
  mirror.style.borderRadius = "18px";
  mirror.style.boxShadow = "0 10px 40px rgba(0,0,0,0.35)";
  stage.appendChild(mirror);
  const mirrorContext = mirror.getContext("2d", { alpha: false, desynchronized: true });

  let pointerDown = false;
  let activePointerId = null;
  let lastMoveSentAt = 0;
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
    lastMoveSentAt = 0;
    try {
      mirror.setPointerCapture(e.pointerId);
    } catch {}
    send({ type: "touch", phase: "down", x: r.x, y: r.y });
    e.preventDefault();
  });
  mirror.addEventListener("pointermove", (e) => {
    if (!pointerDown || e.pointerId !== activePointerId) return;
    const now = Date.now();
    if (now - lastMoveSentAt < 16) return;
    lastMoveSentAt = now;
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

  let queuedFrame = null;
  let renderingFrame = false;
  let renderGeneration = 0;

  function decodeFrameBlob(blob) {
    if (typeof createImageBitmap === "function") return createImageBitmap(blob);
    return new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(blob);
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Android frame decode failed"));
      };
      image.src = url;
    });
  }

  async function renderNextFrame() {
    if (renderingFrame || !queuedFrame) return;
    const payload = queuedFrame;
    queuedFrame = null;
    if (!payload) return;
    const generation = renderGeneration;
    const u8 = payload instanceof Uint8Array ? payload : new Uint8Array(payload);
    const isJpeg = u8[0] === 0xff && u8[1] === 0xd8;
    renderingFrame = true;
    try {
      if (!mirrorContext) throw new Error("Canvas rendering context unavailable");
      const blob = new Blob([u8], { type: isJpeg ? "image/jpeg" : "image/png" });
      const image = await decodeFrameBlob(blob);
      if (generation !== renderGeneration) {
        image.close?.();
        return;
      }
      const width = image.width || image.naturalWidth;
      const height = image.height || image.naturalHeight;
      if (width > 0 && height > 0) {
        if (mirror.width !== width || mirror.height !== height) {
          mirror.width = width;
          mirror.height = height;
          mirror.style.aspectRatio = `${width} / ${height}`;
        }
        mirrorContext.drawImage(image, 0, 0, width, height);
      }
      image.close?.();
      if (mirror.style.display === "none") {
        mirror.style.display = "";
        placeholder.style.display = "none";
      }
    } catch (e) {
      setStatus(panel, "Frame decode failed: " + String(e?.message || e));
    } finally {
      renderingFrame = false;
      if (queuedFrame) requestAnimationFrame(() => renderNextFrame());
    }
  }
  const onFrame = (payload) => {
    queuedFrame = payload;
    renderNextFrame();
  };
  const onMeta = (meta) => {
    panel.__codexppAndroidEmuMeta = meta;
    api.log?.info?.("android-emu stream meta", meta);
  };
  const onStatus = (status) => {
    if (!status) return;
    if (status.kind === "starting") setStatus(panel, status.message || "Starting Android capture...");
    else if (status.kind === "stopped") {
      renderGeneration += 1;
      queuedFrame = null;
      mirror.style.display = "none";
      placeholder.style.display = "";
      if (status.reason && status.reason !== "client-stop") {
        setStatus(panel, "Capture stopped: " + status.reason);
      }
    } else if (status.kind === "error") {
      renderGeneration += 1;
      queuedFrame = null;
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
    renderGeneration += 1;
    queuedFrame = null;
    renderingFrame = false;
    mirrorContext?.clearRect(0, 0, mirror.width, mirror.height);
    mirror.width = 1;
    mirror.height = 1;
    mirror.style.aspectRatio = "1 / 1";
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

function customPanelSelector() {
  return CUSTOM_PANEL_ATTRS.map((attr) => `[${attr}="tabpanel"]`).join(",");
}

function customTabSelector() {
  return CUSTOM_PANEL_ATTRS.map((attr) => `[${attr}="side-tab"]`).join(",");
}

function isCustomPanel(panel) {
  return CUSTOM_PANEL_ATTRS.some((attr) => panel.hasAttribute(attr));
}

function detachPanelCapture(panel) {
  try {
    panel.__codexppAndroidEmuDetachCapture?.();
  } catch {}
  try {
    panel.__codexppIosSimDetachCapture?.();
  } catch {}
}

function setSideTabSelected(tabWrap, selected) {
  const tab = tabWrap?.querySelector?.('[role="tab"]');
  if (selected) tabWrap?.setAttribute?.("data-selected", "true");
  else tabWrap?.removeAttribute?.("data-selected");
  tab?.setAttribute("aria-selected", selected ? "true" : "false");
  tab?.classList.toggle("text-token-text-primary", selected);
  tab?.classList.toggle("text-token-text-secondary", !selected);
}

function hidePanelsForCustomTab(panelHost, activePanel) {
  for (const nativePanel of panelHost.querySelectorAll(':scope > [role="tabpanel"]')) {
    if (nativePanel === activePanel) continue;
    if (isCustomPanel(nativePanel)) {
      nativePanel.style.display = "none";
      detachPanelCapture(nativePanel);
      continue;
    }
    if (!nativePanel.hasAttribute(CUSTOM_PANEL_PREV_DISPLAY_ATTR)) {
      nativePanel.setAttribute(
        CUSTOM_PANEL_PREV_DISPLAY_ATTR,
        legacyPanelDisplayValue(nativePanel) ?? nativePanel.style.display ?? "",
      );
    }
    clearLegacyPanelDisplayAttrs(nativePanel);
    nativePanel.style.display = "none";
  }
}

function restoreNativePanels(panelHost) {
  for (const nativePanel of panelHost.querySelectorAll(':scope > [role="tabpanel"]')) {
    if (isCustomPanel(nativePanel)) continue;
    const previous =
      nativePanel.getAttribute(CUSTOM_PANEL_PREV_DISPLAY_ATTR) ??
      legacyPanelDisplayValue(nativePanel);
    if (previous !== null) {
      nativePanel.style.display = previous;
      nativePanel.removeAttribute(CUSTOM_PANEL_PREV_DISPLAY_ATTR);
      clearLegacyPanelDisplayAttrs(nativePanel);
    }
  }
}

function legacyPanelDisplayValue(panel) {
  for (const attr of LEGACY_PANEL_PREV_DISPLAY_ATTRS) {
    const value = panel.getAttribute(attr);
    if (value !== null) return value;
  }
  return null;
}

function clearLegacyPanelDisplayAttrs(panel) {
  for (const attr of LEGACY_PANEL_PREV_DISPLAY_ATTRS) panel.removeAttribute(attr);
}

function activateEmuPanel(panelHost, tab, panel) {
  hidePanelsForCustomTab(panelHost, panel);

  for (const nativeTab of panelHost.querySelectorAll('[role="tab"]')) {
    nativeTab.setAttribute("aria-selected", "false");
    nativeTab.classList.remove("text-token-text-primary");
    nativeTab.classList.add("text-token-text-secondary");
  }
  for (const customTab of document.querySelectorAll(customTabSelector())) {
    if (customTab !== tab) setSideTabSelected(customTab, false);
  }

  setSideTabSelected(tab, true);
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
  const panel = document.querySelector(`[${TWEAK_ATTR}="tabpanel"]`);
  setSideTabSelected(tabWrap, false);
  if (panel instanceof HTMLElement) {
    panel.style.display = "none";
    detachPanelCapture(panel);
  }
  restoreNativePanels(panelHost);
}

function removeEmuPanel() {
  const tablist = findRightTablist();
  const panelHost =
    tablist instanceof HTMLElement ? findPanelHostForTablist(tablist) : null;
  if (panelHost instanceof HTMLElement) deactivateEmuPanel(panelHost);
  document.querySelector(`[${TWEAK_ATTR}="side-tab"]`)?.remove();
  document.querySelector(`[${TWEAK_ATTR}="tabpanel"]`)?.remove();
}

function ensureSidePanelVisible() {
  if (findRightTablist()) return true;
  const toggle = findSidePanelToggle();
  if (!(toggle instanceof HTMLElement)) return false;
  if (toggle.hasAttribute("disabled") || toggle.getAttribute("aria-disabled") === "true") {
    return false;
  }
  if (toggle.getAttribute("aria-pressed") === "true") return false;
  toggle.click();
  return true;
}

function findRightTablist() {
  const customTab = document.querySelector(`[${TWEAK_ATTR}="side-tab"]`);
  const existing = customTab?.closest('[role="tablist"]');
  if (existing instanceof HTMLElement) return existing;

  const addButton = findSidePanelAddButton();
  const toolbar = addButton?.closest(".h-toolbar-pane");
  const toolbarTablist = toolbar?.querySelector('[role="tablist"]');
  if (toolbarTablist instanceof HTMLElement) return toolbarTablist;

  const rightPanelTablist = document.querySelector(
    '[data-app-shell-focus-area="right-panel"] [role="tablist"]',
  );
  if (rightPanelTablist instanceof HTMLElement) return rightPanelTablist;

  for (const tablist of document.querySelectorAll('[role="tablist"]')) {
    if (!(tablist instanceof HTMLElement)) continue;
    if (tablist.querySelector('[data-app-shell-tab-controller="right"]')) {
      return tablist;
    }
  }

  return null;
}

function findPanelHostForTablist(tablist) {
  let node = tablist.parentElement;
  while (node instanceof HTMLElement) {
    try {
      if (node.querySelector(':scope > [role="tabpanel"]')) return node;
    } catch {}
    if (node.getAttribute("data-app-shell-focus-area") === "right-panel") break;
    node = node.parentElement;
  }

  const oldHost = tablist.closest(".flex.h-full.min-h-0.flex-col");
  if (oldHost instanceof HTMLElement && oldHost.querySelector(':scope > [role="tabpanel"]')) {
    return oldHost;
  }

  const rightPanel = tablist.closest('[data-app-shell-focus-area="right-panel"]');
  if (!(rightPanel instanceof HTMLElement)) return null;
  const hosts = Array.from(rightPanel.querySelectorAll(".h-full.min-h-0.flex-col"));
  return (
    hosts.find(
      (host) =>
        host instanceof HTMLElement &&
        host.contains(tablist) &&
        host.querySelector(':scope > [role="tabpanel"]'),
    ) || null
  );
}

function findSidePanelAddButton() {
  return findButtonByLabel("Open side panel tab");
}

function findSidePanelToggle() {
  return findButtonByLabel("Toggle side panel");
}

function findButtonByLabel(label) {
  const escaped = cssEscape(label);
  const exact = document.querySelector(
    `button[aria-label="${escaped}"],button[title="${escaped}"],[role="button"][aria-label="${escaped}"],[role="button"][title="${escaped}"]`,
  );
  if (exact instanceof HTMLElement) return exact;

  for (const el of document.querySelectorAll("button,[role='button']")) {
    if (!(el instanceof HTMLElement)) continue;
    if (getControlLabel(el) === label) return el;
  }
  return null;
}

function getControlLabel(el) {
  return (
    el.getAttribute("aria-label") ||
    el.getAttribute("title") ||
    compactText(el.textContent || "")
  );
}

function cssEscape(value) {
  if (globalThis.CSS?.escape) return globalThis.CSS.escape(value);
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
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
