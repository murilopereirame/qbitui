# qbitUI — Mobile (Expo / React Native)

A React Native port of **qbitUI** supporting **Android**, **iOS**, and **iPad**, built with [Expo](https://expo.dev/).

## Features

- 📱 Works on Android, iOS (iPhone & iPad)
- 🔒 Credentials stored securely with `expo-secure-store`
- 📋 Full torrent list with live 2-second polling
- ⬇️ Filter by state: Downloading, Seeding, Paused, Completed, Error
- 🔍 Search by name, category, or tag
- ▶ / ⏸ Per-torrent & bulk actions (resume, pause, delete, recheck, reannounce)
- ➕ Add torrents by magnet link or `.torrent` file (`expo-document-picker`)
- 📊 Live download/upload speed in the top bar
- 📱 → 🖥 iPad split-pane sidebar (auto-activates on screens ≥ 768 px wide)

## Architecture

The mobile app is part of the **qbitUI monorepo**:

```
packages/
  core/      # Shared types, QBitAPI client, format utilities (pure TS)
  mobile/    # This Expo app
(root)       # Next.js web + Electron app (unchanged)
```

Unlike the web app, the mobile app calls **qBittorrent directly** from the device — no Next.js proxy is involved. Your device must be able to reach the qBittorrent host (e.g. on the same LAN, or via a VPN / public URL).

## Prerequisites

- [Node.js](https://nodejs.org/) ≥ 20
- [Expo CLI](https://docs.expo.dev/get-started/installation/): `npm install -g expo-cli`
- For native builds: [EAS CLI](https://docs.expo.dev/eas/): `npm install -g eas-cli`
- Expo Go app on your device (for development)

## Getting Started

The mobile app manages its own `node_modules` separately from the root workspace to avoid React version conflicts (root uses React 19; React Native / Expo SDK 52 requires React 18).

```bash
# Install mobile dependencies from the packages/mobile directory
cd packages/mobile
npm install

# Start the Expo dev server
npx expo start
```

Then scan the QR code with **Expo Go** (Android/iOS) or press `i` / `a` to open in an iOS/Android simulator.

## Building for Distribution

```bash
# Android
npx expo run:android          # local debug build
eas build --platform android  # EAS cloud build

# iOS
npx expo run:ios              # requires macOS + Xcode
eas build --platform ios      # EAS cloud build

# Both platforms
eas build --platform all
```

## EAS Build

The project ships with an `eas.json` configuration:

| Profile       | Type         | Distribution |
|---------------|--------------|--------------|
| `development` | dev client   | internal     |
| `preview`     | APK / ad-hoc | internal     |
| `production`  | store build  | store        |

Run `eas build:configure` to link the project to your EAS account before the first build.

## iPad support

iPad layout is handled in `app/(tabs)/_layout.tsx` via `useWindowDimensions`. On screens ≥ 768 dp wide, a persistent sidebar is rendered alongside the main content (split-pane). On narrower screens the sidebar is accessible via the ☰ drawer button in the top bar.
