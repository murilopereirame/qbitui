import { app, BrowserWindow, shell, ipcMain, safeStorage, Menu } from "electron";
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

function appendLog(chunk: Buffer | string): void {
  const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
  for (const line of text.split("\n")) {
    if (line.trim()) serverLogs.push(line);
  }
  if (serverLogs.length > MAX_LOG_LINES) {
    serverLogs.splice(0, serverLogs.length - MAX_LOG_LINES);
  }
}

interface SavedCredentials {
  host: string;
  username: string;
  password: string;
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

function getCredentialsPath(): string {
  return path.join(app.getPath("userData"), "credentials.bin");
}

function readCredentials(): SavedCredentials | null {
  try {
    if (!safeStorage.isEncryptionAvailable()) return null;
    const file = getCredentialsPath();
    if (!fs.existsSync(file)) return null;
    const encrypted = Buffer.from(fs.readFileSync(file, "utf8"), "base64");
    const decrypted = safeStorage.decryptString(encrypted);
    const parsed = JSON.parse(decrypted) as SavedCredentials;
    if (!parsed.host || !parsed.username || !parsed.password) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCredentials(credentials: SavedCredentials): boolean {
  try {
    if (!safeStorage.isEncryptionAvailable()) return false;
    const payload = JSON.stringify(credentials);
    const encrypted = safeStorage.encryptString(payload);
    fs.writeFileSync(getCredentialsPath(), encrypted.toString("base64"), "utf8");
    return true;
  } catch {
    return false;
  }
}

function clearCredentials(): boolean {
  try {
    const file = getCredentialsPath();
    if (fs.existsSync(file)) fs.unlinkSync(file);
    return true;
  } catch (error) {
    console.error("Failed to clear saved credentials:", error);
    return false;
  }
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

  serverProcess.on("exit", (code) => {
    if (code !== 0) {
      console.error(`Embedded Next.js server exited with code ${code}`);
    }
  });

  serverProcess.stdout?.on("data", appendLog);
  serverProcess.stderr?.on("data", appendLog);

  await waitForServer(`http://127.0.0.1:${PORT}`);
}

// ---------------------------------------------------------------------------
// Window helpers
// ---------------------------------------------------------------------------

function createLogsWindow(): void {
  if (logsWindow) {
    logsWindow.focus();
    return;
  }

  logsWindow = new BrowserWindow({
    width: 960,
    height: 640,
    title: "Server Logs — qbitUI",
    backgroundColor: "#030712",
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
    autoHideMenuBar: true,
    backgroundColor: "#030712",
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
  ipcMain.handle("credentials:get", () => {
    return readCredentials();
  });

  ipcMain.handle("credentials:set", (_event, credentials: SavedCredentials) => {
    return writeCredentials(credentials);
  });

  ipcMain.handle("credentials:clear", () => {
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
      console.error("Failed to start embedded server:", err);
      app.quit();
      return;
    }
  }

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
  serverProcess?.kill();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  serverProcess?.kill();
});
