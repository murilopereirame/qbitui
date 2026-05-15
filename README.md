# qbitUI

A modern, production-ready web interface for qBittorrent built with Next.js, TailwindCSS, and shadcn/ui.

## Features

- 🔐 **Secure authentication** — cookie-based session management with iron-session
- 📋 **Torrent management** — add, pause, resume, delete, recheck, reannounce
- 🔗 **Magnet links** — paste one or multiple magnet links at once
- 📁 **Torrent file upload** — drag-and-drop `.torrent` file upload with multi-file support
- 📊 **Live updates** — 2-second polling for real-time progress, speeds, and state
- 🔍 **Filter & search** — filter by state (all/downloading/seeding/paused/completed/error)
- 📦 **Bulk actions** — select multiple torrents and apply actions in bulk
- 🌙 **Dark mode** — dark UI by default
- 📱 **Responsive** — works on desktop and mobile
- 🛡️ **Proxy layer** — all qBittorrent API calls go through Next.js API routes (no CORS issues, credentials never reach the browser)

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: TailwindCSS + custom shadcn/ui components
- **Data fetching**: TanStack Query (2s polling)
- **State management**: Zustand
- **Session storage**: iron-session (encrypted httpOnly cookie)
- **Notifications**: Sonner

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
