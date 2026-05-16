import { TorrentFilter, TorrentState } from './types';

/** Converts a 0-1 progress value to a React Native DimensionValue percentage string. */
export function toPercent(progress: number): `${number}%` {
  return `${Math.round(progress * 100)}%`;
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export const FILTER_STATES: Record<Exclude<TorrentFilter, 'all'>, TorrentState[]> = {
  // Intentionally includes pausedDL/stoppedDL: a paused-in-progress download still belongs
  // to the "downloading" category (matching the web app behaviour in components/layout/Sidebar.tsx).
  downloading: ['downloading', 'stalledDL', 'metaDL', 'forcedDL', 'queuedDL', 'allocating', 'pausedDL', 'stoppedDL'],
  seeding: ['uploading', 'stalledUP', 'forcedUP', 'queuedUP'],
  paused: ['pausedDL', 'pausedUP', 'stoppedDL', 'stoppedUP'],
  completed: ['uploading', 'stalledUP', 'forcedUP', 'pausedUP', 'queuedUP'],
  error: ['error', 'missingFiles'],
};

export function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec === 0) return '0 B/s';
  return formatBytes(bytesPerSec) + '/s';
}

/** qBittorrent uses 8640000 (100 days in seconds) as a sentinel for "infinite" ETA. */
const MAX_ETA_SECONDS = 8640000;

export function formatETA(seconds: number): string {
  if (seconds < 0 || seconds === MAX_ETA_SECONDS) return '∞';
  if (seconds === 0) return 'Done';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function formatRatio(ratio: number): string {
  if (ratio > 100) return '∞';
  return ratio.toFixed(2);
}

export function formatDate(timestamp: number): string {
  if (!timestamp || timestamp < 0) return '—';
  return new Date(timestamp * 1000).toLocaleDateString();
}

export function getStateLabel(state: TorrentState): string {
  const labels: Record<TorrentState, string> = {
    downloading: 'Downloading',
    uploading: 'Seeding',
    pausedDL: 'Paused',
    pausedUP: 'Paused',
    stoppedDL: 'Stopped',
    stoppedUP: 'Stopped',
    stalledDL: 'Stalled',
    stalledUP: 'Stalled',
    checkingDL: 'Checking',
    checkingUP: 'Checking',
    checkingResumeData: 'Checking',
    queuedDL: 'Queued',
    queuedUP: 'Queued',
    error: 'Error',
    missingFiles: 'Missing Files',
    allocating: 'Allocating',
    metaDL: 'Fetching Metadata',
    forcedDL: 'Forced DL',
    forcedUP: 'Forced Seed',
    moving: 'Moving',
  };
  return labels[state] ?? state;
}

export type StateColor = 'blue' | 'green' | 'yellow' | 'gray' | 'purple' | 'orange' | 'red' | 'cyan';

export function getStateColor(state: TorrentState): StateColor {
  switch (state) {
    case 'downloading':
    case 'forcedDL':
    case 'metaDL':
      return 'blue';
    case 'uploading':
    case 'forcedUP':
      return 'green';
    case 'pausedDL':
    case 'pausedUP':
    case 'stoppedDL':
    case 'stoppedUP':
      return 'yellow';
    case 'stalledDL':
    case 'stalledUP':
      return 'gray';
    case 'checkingDL':
    case 'checkingUP':
    case 'checkingResumeData':
    case 'allocating':
      return 'purple';
    case 'queuedDL':
    case 'queuedUP':
      return 'orange';
    case 'error':
    case 'missingFiles':
      return 'red';
    case 'moving':
      return 'cyan';
    default:
      return 'gray';
  }
}
