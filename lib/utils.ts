import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { TorrentState } from "./types";

// We use 999 as a pseudo-infinite ratio sentinel and let formatRatio() render it as "∞".
const INFINITE_RATIO = 999;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec === 0) return "0 B/s";
  return formatBytes(bytesPerSec) + "/s";
}

export function formatETA(seconds: number): string {
  if (seconds < 0 || seconds === 8640000) return "∞";
  if (seconds === 0) return "Done";
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
  if (ratio > 100) return "∞";
  return ratio.toFixed(2);
}

export function calculateUploadedDownloadedRatio(uploaded: number, downloaded: number): number {
  if (downloaded <= 0) return uploaded > 0 ? INFINITE_RATIO : 0;
  return uploaded / downloaded;
}

export function formatDate(timestamp: number): string {
  if (!timestamp || timestamp < 0) return "—";
  return new Date(timestamp * 1000).toLocaleDateString();
}

export function getStateLabel(state: TorrentState): string {
  const labels: Record<TorrentState, string> = {
    downloading: "Downloading",
    uploading: "Seeding",
    pausedDL: "Paused",
    pausedUP: "Paused",
    stoppedDL: "Stopped",
    stoppedUP: "Stopped",
    stalledDL: "Stalled",
    stalledUP: "Stalled",
    checkingDL: "Checking",
    checkingUP: "Checking",
    checkingResumeData: "Checking",
    queuedDL: "Queued",
    queuedUP: "Queued",
    error: "Error",
    missingFiles: "Missing Files",
    allocating: "Allocating",
    metaDL: "Fetching Metadata",
    forcedDL: "Forced DL",
    forcedUP: "Forced Seed",
    moving: "Moving",
  };
  return labels[state] ?? state;
}

// Badge tints: the light theme needs a darker text shade to stay legible on
// the same translucent background, hence the paired light/dark classes.
const STATE_COLORS = {
  blue: "bg-blue-500/15 text-blue-700 border-blue-500/30 dark:bg-blue-500/20 dark:text-blue-400",
  green: "bg-green-500/15 text-green-700 border-green-500/30 dark:bg-green-500/20 dark:text-green-400",
  yellow: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30 dark:bg-yellow-500/20 dark:text-yellow-400",
  gray: "bg-gray-500/15 text-gray-700 border-gray-500/30 dark:bg-gray-500/20 dark:text-gray-400",
  purple: "bg-purple-500/15 text-purple-700 border-purple-500/30 dark:bg-purple-500/20 dark:text-purple-400",
  orange: "bg-orange-500/15 text-orange-700 border-orange-500/30 dark:bg-orange-500/20 dark:text-orange-400",
  red: "bg-red-500/15 text-red-700 border-red-500/30 dark:bg-red-500/20 dark:text-red-400",
  cyan: "bg-cyan-500/15 text-cyan-700 border-cyan-500/30 dark:bg-cyan-500/20 dark:text-cyan-400",
} as const;

export const CATEGORY_BADGE_COLOR = STATE_COLORS.purple;

export function getStateColor(state: TorrentState): string {
  switch (state) {
    case "downloading":
    case "forcedDL":
    case "metaDL":
      return STATE_COLORS.blue;
    case "uploading":
    case "forcedUP":
      return STATE_COLORS.green;
    case "pausedDL":
    case "pausedUP":
    case "stoppedDL":
    case "stoppedUP":
      return STATE_COLORS.yellow;
    case "stalledDL":
    case "stalledUP":
      return STATE_COLORS.gray;
    case "checkingDL":
    case "checkingUP":
    case "checkingResumeData":
    case "allocating":
      return STATE_COLORS.purple;
    case "queuedDL":
    case "queuedUP":
      return STATE_COLORS.orange;
    case "error":
    case "missingFiles":
      return STATE_COLORS.red;
    case "moving":
      return STATE_COLORS.cyan;
    default:
      return STATE_COLORS.gray;
  }
}

/** Splits qBittorrent's comma-separated `tags` field into trimmed tag names. */
export function parseTorrentTags(tags: string | undefined): string[] {
  if (!tags) return [];
  return tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export const TAG_BADGE_COLOR = STATE_COLORS.cyan;
