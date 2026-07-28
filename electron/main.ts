import { app, BrowserWindow, shell, ipcMain, Menu, nativeImage, nativeTheme } from "electron";
import keytar from "keytar";
import { utilityProcess, UtilityProcess } from "electron";
import path from "path";
import http from "http";
import crypto from "crypto";
import fs from "fs";
import { execFileSync } from "child_process";

// True when launched via `electron .` (development), false when packaged.
const isDev = !app.isPackaged;

// ---------------------------------------------------------------------------
// Single-instance lock
// Ensures only one copy of the app ever runs.  When Windows/Linux launch a
// second instance for a file-association or protocol open, we forward the
// argv to the first instance via the `second-instance` event then quit
// immediately.  Without this the second instance would hang in the taskbar
// because its embedded Next.js server cannot bind to a port already occupied
// by the first instance.
// ---------------------------------------------------------------------------
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

const PORT = 3000;
// Generate a fresh random secret for each app session.
// iron-session cookies are re-issued on next login if the secret rotates.
const SESSION_SECRET = crypto.randomBytes(32).toString("hex");

let mainWindow: BrowserWindow | null = null;
let logsWindow: BrowserWindow | null = null;
let serverProcess: UtilityProcess | null = null;

// Pending protocol events received before the window is ready.
let pendingOpenUrl: string | null = null;
interface PendingFile { name: string; data: string }
let pendingOpenFile: PendingFile | null = null;

// ---------------------------------------------------------------------------
// Server log buffer
// ---------------------------------------------------------------------------

const MAX_LOG_LINES = 2_000;
const serverLogs: string[] = [];

function timestamp(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 23);
}

function appendLog(chunk: Buffer | string, prefix = ""): void {
  const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
  const ts = timestamp();
  for (const line of text.split("\n")) {
    if (line.trim()) serverLogs.push(`[${ts}]${prefix} ${line}`);
  }
  if (serverLogs.length > MAX_LOG_LINES) {
    serverLogs.splice(0, serverLogs.length - MAX_LOG_LINES);
  }
}

function logElectron(message: string): void {
  appendLog(message, "[electron]");
}

interface SavedCredentials {
  host: string;
  apiToken: string;
}

// ---------------------------------------------------------------------------
// Credential storage (keytar — system keychain)
// ---------------------------------------------------------------------------

const KEYTAR_SERVICE = "qbitui";
const KEYTAR_ACCOUNT = "credentials";

async function readCredentials(): Promise<SavedCredentials | null> {
  try {
    const json = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
    if (!json) return null;
    const parsed = JSON.parse(json) as SavedCredentials;
    if (!parsed.host || !parsed.apiToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeCredentials(credentials: SavedCredentials): Promise<boolean> {
  try {
    await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT, JSON.stringify(credentials));
    return true;
  } catch {
    return false;
  }
}

async function clearCredentials(): Promise<boolean> {
  try {
    await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

function getServerScriptPath(): string {
  if (isDev) {
    // During development the Next.js standalone build lives next to the repo root.
    return path.resolve(__dirname, "..", "..", ".next", "standalone", "server.js");
  }
  // In a packaged app electron-builder extracts the .next directory outside of
  // the asar archive (see "asarUnpack" in package.json) so we can fork it.
  return path.join(
    process.resourcesPath,
    "app.asar.unpacked",
    ".next",
    "standalone",
    "server.js"
  );
}

// ---------------------------------------------------------------------------
// Server lifecycle
// ---------------------------------------------------------------------------

function waitForServer(url: string, timeoutMs = 30_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;

    function attempt() {
      const req = http.get(url, () => {
        resolve();
      });
      req.on("error", () => {
        if (Date.now() >= deadline) {
          reject(new Error(`Embedded Next.js server did not become ready within ${timeoutMs} ms`));
          return;
        }
        setTimeout(attempt, 500);
      });
      req.setTimeout(1000, () => {
        req.destroy();
        if (Date.now() >= deadline) {
          reject(new Error(`Embedded Next.js server timed out after ${timeoutMs} ms`));
          return;
        }
        setTimeout(attempt, 500);
      });
    }

    // Give the server a head-start before polling.
    setTimeout(attempt, 800);
  });
}

async function startEmbeddedServer(): Promise<void> {
  const serverScript = getServerScriptPath();
  const cwd = path.dirname(serverScript);

  serverProcess = utilityProcess.fork(serverScript, [], {
    env: {
      ...process.env,
      PORT: String(PORT),
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
      // Tells lib/session.ts not to require HTTPS for cookies (we serve over
      // plain HTTP on localhost inside the Electron shell).
      ELECTRON_APP: "true",
      SESSION_SECRET,
    },
    cwd,
    stdio: "pipe",
  });

  logElectron(`Starting embedded Next.js server (port ${PORT})`);

  serverProcess.on("exit", (code) => {
    if (code !== 0) {
      console.error(`Embedded Next.js server exited with code ${code}`);
      logElectron(`Server exited with code ${code}`);
    } else {
      logElectron("Server exited cleanly");
    }
  });

  serverProcess.stdout?.on("data", (chunk) => appendLog(chunk, "[server]"));
  serverProcess.stderr?.on("data", (chunk) => appendLog(chunk, "[server]"));

  await waitForServer(`http://127.0.0.1:${PORT}`);
  logElectron("Embedded server is ready");
}

// ---------------------------------------------------------------------------
// Window helpers
// ---------------------------------------------------------------------------

/**
 * The app icon, used for the taskbar/dock on Linux and Windows.  macOS takes
 * its icon from the bundle, so an empty image there is harmless.
 */
function appIcon(): Electron.NativeImage | undefined {
  const image = nativeImage.createFromPath(path.join(__dirname, "..", "icon.png"));
  return image.isEmpty() ? undefined : image;
}

/** Window chrome colour matching the web UI's current theme. */
function windowBackground(): string {
  return nativeTheme.shouldUseDarkColors ? "#030712" : "#ffffff";
}

function createLogsWindow(): void {
  if (logsWindow) {
    logsWindow.focus();
    return;
  }

  logsWindow = new BrowserWindow({
    width: 960,
    height: 640,
    title: "Server Logs — qbitUI",
    icon: appIcon(),
    backgroundColor: windowBackground(),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const logsUrl = isDev
    ? `http://localhost:${PORT}/logs`
    : `http://127.0.0.1:${PORT}/logs`;

  logsWindow.loadURL(logsUrl);

  logsWindow.on("closed", () => {
    logsWindow = null;
  });
}

function buildApplicationMenu(): void {
  const isMac = process.platform === "darwin";

  const template: Electron.MenuItemConstructorOptions[] = [
    // macOS application menu
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" as const },
              { type: "separator" as const },
              { role: "services" as const },
              { type: "separator" as const },
              { role: "hide" as const },
              { role: "hideOthers" as const },
              { role: "unhide" as const },
              { type: "separator" as const },
              { role: "quit" as const },
            ],
          },
        ]
      : []),
    {
      label: "Edit",
      submenu: [
        { role: "cut" as const },
        { role: "copy" as const },
        { role: "paste" as const },
        { role: "selectAll" as const },
      ],
    },
    {
      label: "View",
      submenu: [
        {
          label: "Server Logs…",
          accelerator: "CmdOrCtrl+L",
          click: () => createLogsWindow(),
        },
        { type: "separator" as const },
        { role: "reload" as const },
        { role: "forceReload" as const },
        { role: "toggleDevTools" as const },
        { type: "separator" as const },
        { role: "resetZoom" as const },
        { role: "zoomIn" as const },
        { role: "zoomOut" as const },
        { type: "separator" as const },
        { role: "togglefullscreen" as const },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" as const },
        { role: "zoom" as const },
        ...(isMac
          ? [{ type: "separator" as const }, { role: "front" as const }]
          : [{ role: "close" as const }]),
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "qbitUI",
    icon: appIcon(),
    autoHideMenuBar: true,
    backgroundColor: windowBackground(),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // In dev, point to the already-running Next.js dev server.
  const appUrl = isDev
    ? `http://localhost:${PORT}`
    : `http://127.0.0.1:${PORT}`;

  mainWindow.loadURL(appUrl);

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  // Open external links in the OS default browser instead of a new Electron window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(`http://127.0.0.1:${PORT}`) && !url.startsWith(`http://localhost:${PORT}`)) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ---------------------------------------------------------------------------
// .torrent file-type handler helpers
// ---------------------------------------------------------------------------

const LSREGISTER = "/System/Library/Frameworks/CoreServices.framework/Versions/A/Support/lsregister";

function getTorrentHandlerFlagPath(): string {
  return path.join(app.getPath("userData"), "torrentHandlerRegistered.flag");
}

/** Returns the .app bundle path (macOS only, production only). */
function getAppBundlePath(): string | null {
  if (process.platform !== "darwin" || isDev) return null;
  // process.execPath is e.g. /Applications/qbitUI.app/Contents/MacOS/qbitUI
  return path.resolve(process.execPath, "..", "..", "..");
}

function isTorrentHandlerRegistered(): boolean {
  if (process.platform === "darwin") {
    return fs.existsSync(getTorrentHandlerFlagPath());
  }
  return false;
}

function registerTorrentHandler(): boolean {
  if (process.platform === "darwin") {
    const bundlePath = getAppBundlePath();
    if (!bundlePath) return false;
    try {
      execFileSync(LSREGISTER, ["-R", "-f", bundlePath]);
      fs.writeFileSync(getTorrentHandlerFlagPath(), "1", "utf8");
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

function unregisterTorrentHandler(): boolean {
  if (process.platform === "darwin") {
    const bundlePath = getAppBundlePath();
    if (!bundlePath) return false;
    try {
      execFileSync(LSREGISTER, ["-u", bundlePath]);
      const flagPath = getTorrentHandlerFlagPath();
      if (fs.existsSync(flagPath)) fs.unlinkSync(flagPath);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Protocol / file-type handler events
// (Must be registered before app.whenReady so they work from cold launch too)
// ---------------------------------------------------------------------------

// Always store pending items regardless of whether mainWindow exists.
// The renderer drains these via IPC on mount. We also send a real-time IPC
// message when the window already exists so an already-open modal reacts
// immediately without waiting for remount.

/**
 * Parse a list of command-line arguments (process.argv or the argv forwarded
 * by a second instance) looking for .torrent file paths and magnet: URLs.
 * On Windows/Linux the OS passes file-association paths via argv rather than
 * firing the macOS-only `open-file` / `open-url` events.
 *
 * We skip the first entry (the executable) and any flags starting with `-`.
 */
function handleArgv(argv: string[]): void {
  // Skip the executable (argv[0]) and any electron/chromium flags.
  const args = argv.slice(1).filter((a) => !a.startsWith("-"));
  for (const arg of args) {
    if (arg.startsWith("magnet:")) {
      pendingOpenUrl = arg;
      if (mainWindow) {
        mainWindow.webContents.send("open-url", arg);
        mainWindow.focus();
      }
      return;
    }
    if (arg.toLowerCase().endsWith(".torrent") && fs.existsSync(arg)) {
      let fileData: string;
      try {
        fileData = fs.readFileSync(arg).toString("base64");
      } catch {
        continue;
      }
      const payload: PendingFile = { name: path.basename(arg), data: fileData };
      pendingOpenFile = payload;
      if (mainWindow) {
        mainWindow.webContents.send("open-file", payload);
        mainWindow.focus();
      }
      return;
    }
  }
}

// Second-instance: fired in the FIRST (already-running) instance when a
// second instance tried to start.  argv contains the second instance's
// command-line arguments — extract any torrent/magnet from there.
app.on("second-instance", (_event, argv) => {
  handleArgv(argv);
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on("open-url", (event, url) => {
  event.preventDefault();
  pendingOpenUrl = url;
  if (mainWindow) {
    mainWindow.webContents.send("open-url", url);
    mainWindow.focus();
  }
});

app.on("open-file", (event, filePath) => {
  event.preventDefault();
  if (!filePath.toLowerCase().endsWith(".torrent")) return;
  let fileData: string;
  try {
    fileData = fs.readFileSync(filePath).toString("base64");
  } catch {
    return;
  }
  const payload: PendingFile = { name: path.basename(filePath), data: fileData };
  pendingOpenFile = payload;
  if (mainWindow) {
    mainWindow.webContents.send("open-file", payload);
    mainWindow.focus();
  }
});

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(async () => {
  logElectron(`App ready — pid=${process.pid} mode=${isDev ? "dev" : "production"} platform=${process.platform}`);

  // In development macOS shows the generic Electron dock icon; set ours.
  if (isDev && process.platform === "darwin") {
    const icon = appIcon();
    if (icon) app.dock?.setIcon(icon);
  }

  // Keep the window chrome in step when the OS switches between light/dark.
  nativeTheme.on("updated", () => {
    for (const window of [mainWindow, logsWindow]) {
      window?.setBackgroundColor(windowBackground());
    }
  });

  ipcMain.handle("credentials:get", () => readCredentials());
  ipcMain.handle("credentials:set", (_event, credentials: SavedCredentials) => {
    logElectron(`Credentials saved for host: ${credentials.host}`);
    return writeCredentials(credentials);
  });
  ipcMain.handle("credentials:clear", () => {
    logElectron("Credentials cleared");
    return clearCredentials();
  });

  ipcMain.handle("logs:get", () => serverLogs.slice());

  // Drain handlers: renderer calls these on mount to pick up events that fired
  // before the React component subscribed (e.g. cold-start file open).
  ipcMain.handle("pending:open-url:consume", () => {
    const url = pendingOpenUrl;
    pendingOpenUrl = null;
    return url;
  });
  ipcMain.handle("pending:open-file:consume", () => {
    const file = pendingOpenFile;
    pendingOpenFile = null;
    return file;
  });

  ipcMain.handle("handlers:magnet:status", () => app.isDefaultProtocolClient("magnet"));
  ipcMain.handle("handlers:magnet:set", (_event, enable: boolean) =>
    enable
      ? app.setAsDefaultProtocolClient("magnet")
      : app.removeAsDefaultProtocolClient("magnet")
  );

  ipcMain.handle("handlers:torrent:status", () => isTorrentHandlerRegistered());
  ipcMain.handle("handlers:torrent:set", (_event, enable: boolean) => {
    if (enable) return registerTorrentHandler();
    return unregisterTorrentHandler();
  });

  buildApplicationMenu();

  if (!isDev) {
    try {
      await startEmbeddedServer();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Failed to start embedded server:", err);
      logElectron(`Failed to start embedded server: ${msg}`);
      app.quit();
      return;
    }
  }

  logElectron("Creating main window");
  createWindow();

  // Windows / Linux cold-start: when the OS launches the app for a file
  // association or protocol, the path/URL arrives in process.argv rather than
  // via the macOS-only open-file / open-url events.  Parse it now so the
  // pending drain handlers have data ready when the renderer mounts.
  if (process.platform !== "darwin") {
    handleArgv(process.argv);
  }

  // macOS: re-open the window when the dock icon is clicked and no windows exist.
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  logElectron("All windows closed");
  serverProcess?.kill();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  logElectron("App quitting");
  serverProcess?.kill();
});
