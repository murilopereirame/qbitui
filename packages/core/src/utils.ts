import { TorrentState } from "./types";

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

export type StateColorVariant = "blue" | "green" | "yellow" | "gray" | "purple" | "orange" | "red" | "cyan";

export function getStateColorVariant(state: TorrentState): StateColorVariant {
  switch (state) {
    case "downloading":
    case "forcedDL":
    case "metaDL":
      return "blue";
    case "uploading":
    case "forcedUP":
      return "green";
    case "pausedDL":
    case "pausedUP":
      return "yellow";
    case "stalledDL":
    case "stalledUP":
      return "gray";
    case "checkingDL":
    case "checkingUP":
    case "checkingResumeData":
    case "allocating":
      return "purple";
    case "queuedDL":
    case "queuedUP":
      return "orange";
    case "error":
    case "missingFiles":
      return "red";
    case "moving":
      return "cyan";
    default:
      return "gray";
  }
}

export function filterTorrents<T extends { state: TorrentState; progress: number }>(
  torrents: T[],
  filter: string
): T[] {
  if (filter === "all") return torrents;
  return torrents.filter((t) => {
    switch (filter) {
      case "downloading":
        return ["downloading", "stalledDL", "metaDL", "forcedDL", "queuedDL", "allocating"].includes(t.state);
      case "seeding":
        return ["uploading", "stalledUP", "forcedUP", "queuedUP"].includes(t.state);
      case "paused":
        return ["pausedDL", "pausedUP"].includes(t.state);
      case "completed":
        return t.progress === 1 || ["uploading", "stalledUP", "forcedUP", "pausedUP", "queuedUP"].includes(t.state);
      case "error":
        return ["error", "missingFiles"].includes(t.state);
      default:
        return true;
    }
  });
}

export function countByFilter<T extends { state: TorrentState; progress: number }>(
  torrents: T[]
): Record<string, number> {
  return {
    all: torrents.length,
    downloading: filterTorrents(torrents, "downloading").length,
    seeding: filterTorrents(torrents, "seeding").length,
    paused: filterTorrents(torrents, "paused").length,
    completed: filterTorrents(torrents, "completed").length,
    error: filterTorrents(torrents, "error").length,
  };
}
