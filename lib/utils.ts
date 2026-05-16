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

export function getStateColor(state: TorrentState): string {
  switch (state) {
    case "downloading":
    case "forcedDL":
    case "metaDL":
      return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "uploading":
    case "forcedUP":
      return "bg-green-500/20 text-green-400 border-green-500/30";
    case "pausedDL":
    case "pausedUP":
    case "stoppedDL":
    case "stoppedUP":
      return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    case "stalledDL":
    case "stalledUP":
      return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    case "checkingDL":
    case "checkingUP":
    case "checkingResumeData":
    case "allocating":
      return "bg-purple-500/20 text-purple-400 border-purple-500/30";
    case "queuedDL":
    case "queuedUP":
      return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    case "error":
    case "missingFiles":
      return "bg-red-500/20 text-red-400 border-red-500/30";
    case "moving":
      return "bg-cyan-500/20 text-cyan-400 border-cyan-500/30";
    default:
      return "bg-gray-500/20 text-gray-400 border-gray-500/30";
  }
}
