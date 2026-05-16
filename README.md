# qbitUI

A modern, production-ready interface for qBittorrent available as a **web app** (Docker / Node.js), a native **Electron desktop app** (macOS, Windows, Linux), and a **React Native mobile app** (Android, iOS, iPad).

## Repository Structure (Monorepo)

```
packages/
  core/      # Shared TypeScript: types, QBitAPI client, format utilities
  mobile/    # React Native / Expo app (Android, iOS, iPad)
(root)       # Next.js web app + Electron wrapper (unchanged)
```

## Features

- 🖥️ **Desktop app** — native Electron packaging for macOS (`.dmg`), Windows (`.exe`), and Linux (`.AppImage` / `.deb`)
- 📱 **Mobile app** — React Native / Expo for Android, iOS (iPhone & iPad)
- 🔐 **Secure authentication** — cookie-based session (web/Electron) / SecureStore (mobile)
- 📋 **Torrent management** — add, pause, resume, delete, recheck, reannounce
- 🔗 **Magnet links** — paste one or multiple magnet links at once
- 📁 **Torrent file upload** — drag-and-drop `.torrent` upload (web) / file picker (mobile)
- 📊 **Live updates** — 2-second polling for real-time progress, speeds, and state
- 🔍 **Filter & search** — filter by state (all/downloading/seeding/paused/completed/error)
- 📦 **Bulk actions** — select multiple torrents and apply actions in bulk
- 🌙 **Dark mode** — dark UI by default
- 🖥↔📱 **iPad split-pane** — persistent sidebar auto-activates on screens ≥ 768 dp wide
- 🛡️ **Proxy layer** — web/Electron: all qBittorrent API calls go through Next.js routes (no CORS issues); mobile: direct device-to-qBittorrent calls

## Tech Stack

### Web / Electron
- **Framework**: Next.js (App Router, `output: standalone`)
- **Language**: TypeScript
- **Styling**: TailwindCSS + custom shadcn/ui components
- **Data fetching**: TanStack Query (2s polling)
- **State management**: Zustand
- **Session storage**: iron-session (encrypted httpOnly cookie)
- **Notifications**: Sonner

### Mobile (React Native)
- **Framework**: Expo (~52) with Expo Router (~4)
- **Language**: TypeScript
- **Styling**: NativeWind v4 (Tailwind syntax for React Native)
- **Data fetching**: TanStack Query (2s polling)
- **State management**: Zustand
- **Session storage**: expo-secure-store
- **File picking**: expo-document-picker
- **Shared logic**: `packages/core` (types, API client, format utilities)

## Quick Start

### Prerequisites

- Node.js 18+
- A running qBittorrent instance with WebUI enabled

### 1. Clone and install

```bash
git clone https://github.com/murilopereirame/qbitui
cd qbitui
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Required: session encryption secret (at least 32 characters)
SESSION_SECRET=your-random-secret-here

# Optional: pre-fill the host on the login page
NEXT_PUBLIC_DEFAULT_HOST=http://localhost:8080
```

### 3. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Login

Enter your qBittorrent WebUI host URL, username, and password.

## Electron Desktop App

qbitUI can run as a native desktop application. The Electron shell embeds the Next.js
server locally on port 3000 and opens a `BrowserWindow` pointing to it. No internet
connection or external server is required — just a reachable qBittorrent WebUI.

### Download a release

Pre-built installers for every platform are published as GitHub Release assets whenever
a version tag (`v*`) is pushed:

| Platform | Format |
|---|---|
| macOS (Apple Silicon + Intel) | `.dmg`, `.zip` |
| Windows | `.exe` (NSIS installer) |
| Linux | `.AppImage`, `.deb` |

### Build locally

```bash
# Install dependencies
npm install

# Build Next.js + compile Electron main process + package
npm run electron:dist          # current platform
npm run electron:dist:mac      # macOS only
npm run electron:dist:win      # Windows only
npm run electron:dist:linux    # Linux only
```

Packaged files are written to `dist-electron/`.

### Development

```bash
# Starts the Next.js dev server AND Electron in one command
npm run electron:dev
```

This uses `concurrently` to start `next dev` and waits for it to be ready before
launching Electron.  
Alternatively, run `npm run dev` and `electron .` in separate terminals.

### CI/CD pipeline

The workflow in `.github/workflows/electron-build.yml` builds installers on every
push to `main` and on every pull request:

| Runner | Output |
|---|---|
| `macos-14` (Apple Silicon) | `.dmg` + `.zip` (x64 & arm64) |
| `windows-latest` | `.exe` (NSIS) |
| `ubuntu-22.04` | `.AppImage` + `.deb` |

On a tag push matching `v*` the workflow additionally creates a GitHub Release and
attaches all installer files as downloadable assets.

**Code signing** — macOS code signing is disabled in CI by default
(`CSC_IDENTITY_AUTO_DISCOVERY=false`). To enable it, add your Developer ID certificate
as `CSC_LINK` and `CSC_KEY_PASSWORD` repository secrets and remove the override.

## Mobile App (React Native / Expo)

See [`packages/mobile/README.md`](packages/mobile/README.md) for the full mobile setup guide.

**Quick start:**
```bash
# Mobile has its own install (React 18 vs root React 19)
cd packages/mobile
npm install
npx expo start                     # scan QR with Expo Go app
```

**Build for stores:**
```bash
eas build --platform android       # Android APK / AAB
eas build --platform ios           # iOS IPA (requires Apple Developer account)
```

## Docker

### Using docker-compose

```bash
cp .env.example .env
# Edit .env with your SESSION_SECRET
docker compose up -d
```

### Using Docker directly

```bash
docker build -t qbitui .
docker run -p 3000:3000 \
  -e SESSION_SECRET=your-secret-here \
  -e NEXT_PUBLIC_DEFAULT_HOST=http://qbittorrent:8080 \
  qbitui
```

## Production Deployment

### Build for production

```bash
npm run build
npm start
```

### Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `SESSION_SECRET` | ✅ | — | Secret for encrypting session cookies (≥32 chars) |
| `NEXT_PUBLIC_DEFAULT_HOST` | ❌ | `http://localhost:8080` | Pre-fills the host URL on the login page |

### Reverse proxy (nginx)

```nginx
server {
    listen 80;
    server_name qbitui.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Architecture

```
Browser <-> Next.js (qbitUI) <-> qBittorrent WebUI API
```

All qBittorrent API calls are proxied through Next.js API routes. The browser never
communicates directly with qBittorrent. Session data (host URL + SID cookie) is stored
in an encrypted httpOnly cookie that is inaccessible to JavaScript.

### API Routes

| Route | Method | Description |
|---|---|---|
| `/api/auth/login` | POST | Authenticate with qBittorrent |
| `/api/auth/logout` | POST | Destroy session |
| `/api/auth/me` | GET | Check authentication status |
| `/api/torrents` | GET | List torrents (with filter support) |
| `/api/torrents` | POST | Add magnet link or torrent file |
| `/api/torrents/action` | POST | Perform action (pause/resume/delete/recheck/reannounce) |
| `/api/transfer` | GET | Global transfer info (speeds) |

## Project Structure

```
├── packages/
│   ├── core/                   # Shared: types, QBitAPI client, format utils
│   │   └── src/
│   │       ├── api.ts
│   │       ├── types.ts
│   │       ├── utils.ts
│   │       └── index.ts
│   └── mobile/                 # React Native / Expo app
│       ├── app/
│       │   ├── _layout.tsx     # Root layout (providers, session loader)
│       │   ├── index.tsx       # Auth redirect
│       │   ├── login.tsx       # Login screen
│       │   └── (tabs)/
│       │       ├── _layout.tsx # Tablet split-pane / phone stack
│       │       └── index.tsx   # Dashboard (torrent list)
│       ├── components/
│       │   ├── TorrentItem.tsx
│       │   ├── AddTorrentModal.tsx
│       │   └── FilterSheet.tsx
│       ├── hooks/
│       │   ├── useSession.ts
│       │   ├── useTorrents.ts
│       │   └── useTransfer.ts
│       ├── store/index.ts
│       ├── app.json
│       └── eas.json
├── electron/
│   ├── main.ts                 # Electron main process (embedded server + BrowserWindow)
│   ├── preload.ts              # Electron preload script
│   └── tsconfig.json           # TypeScript config for Electron main process
├── scripts/
│   └── prepare-standalone.mjs # Copies static/public into the Next.js standalone dir
├── .github/
│   └── workflows/
│       └── electron-build.yml  # macOS / Windows / Linux CI build + release pipeline
├── app/
│   ├── layout.tsx              # Root layout with providers
│   ├── page.tsx                # Login page
│   ├── providers.tsx           # React Query provider
│   ├── dashboard/
│   │   └── page.tsx            # Main dashboard
│   └── api/                    # API proxy routes
│       ├── auth/{login,logout,me}/
│       ├── torrents/
│       │   └── action/
│       └── transfer/
├── components/
│   ├── ui/                     # Base UI components (shadcn-style)
│   ├── auth/
│   │   └── LoginForm.tsx
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   └── TopBar.tsx
│   └── torrents/
│       ├── TorrentTable.tsx
│       ├── TorrentRow.tsx
│       └── AddTorrentModal.tsx
├── hooks/
│   ├── useTorrents.ts
│   └── useTransfer.ts
├── lib/
│   ├── qbit-api.ts             # Server-side qBittorrent API client
│   ├── session.ts              # iron-session configuration
│   ├── types.ts                # TypeScript types
│   └── utils.ts                # Format helpers
├── store/
│   └── index.ts                # Zustand UI state
└── proxy.ts                    # Auth guard (redirects unauthenticated users)
```

## License

MIT
