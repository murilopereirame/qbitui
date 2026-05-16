import { app, BrowserWindow, shell, ipcMain, safeStorage } from "electron";
import { utilityProcess, UtilityProcess } from "electron";
import path from "path";
import http from "http";
import crypto from "crypto";
import fs from "fs";

// True when launched via `electron .` (development), false when packaged.
const isDev = !app.isPackaged;

const PORT = 3000;
// Generate a fresh random secret for each app session.
// iron-session cookies are re-issued on next login if the secret rotates.
const SESSION_SECRET = crypto.randomBytes(32).toString("hex");

let mainWindow: BrowserWindow | null = null;
let serverProcess: UtilityProcess | null = null;

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

function clearCredentials(): void {
  try {
    const file = getCredentialsPath();
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch {
    // ignore
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

  await waitForServer(`http://127.0.0.1:${PORT}`);
}

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------

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
    clearCredentials();
    return true;
  });

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
