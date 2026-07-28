"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  Upload,
  List,
  Pause,
  CheckCircle,
  AlertTriangle,
  LogOut,
  Wifi,
  WifiOff,
  Settings,
  RefreshCw,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TorrentFilter } from "@/lib/types";
import { useUIStore } from "@/store";
import { useTorrents } from "@/hooks/useTorrents";
import { RequestLogsDialog } from "./RequestLogsDialog";

const NAV_ITEMS: { label: string; filter: TorrentFilter; icon: React.ReactNode }[] = [
  { label: "All Torrents", filter: "all", icon: <List className="h-4 w-4" /> },
  { label: "Downloading", filter: "downloading", icon: <Download className="h-4 w-4" /> },
  { label: "Seeding", filter: "seeding", icon: <Upload className="h-4 w-4" /> },
  { label: "Paused", filter: "paused", icon: <Pause className="h-4 w-4" /> },
  { label: "Completed", filter: "completed", icon: <CheckCircle className="h-4 w-4" /> },
  { label: "Error", filter: "error", icon: <AlertTriangle className="h-4 w-4" /> },
];

export function Sidebar() {
  const router = useRouter();
  const { filter, setFilter } = useUIStore();
  const { data, isError, refetch } = useTorrents();
  const [logsOpen, setLogsOpen] = useState(false);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  const counts: Record<TorrentFilter, number> = {
    all: data?.length ?? 0,
    downloading: data?.filter((t) => ["downloading", "stalledDL", "metaDL", "forcedDL", "queuedDL", "allocating", "pausedDL", "stoppedDL"].includes(t.state)).length ?? 0,
    seeding: data?.filter((t) => ["uploading", "stalledUP", "forcedUP", "queuedUP"].includes(t.state)).length ?? 0,
    paused: data?.filter((t) => ["pausedDL", "pausedUP", "stoppedDL", "stoppedUP"].includes(t.state)).length ?? 0,
    completed: data?.filter((t) => t.progress === 1).length ?? 0,
    error: data?.filter((t) => ["error", "missingFiles"].includes(t.state)).length ?? 0,
  };

  return (
    <div className="flex h-full w-56 flex-col border-r border-line bg-chrome">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-line">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" className="w-8 h-8 rounded-lg shrink-0" />
        <span className="font-bold text-foreground text-lg">qbitUI</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {NAV_ITEMS.map(({ label, filter: f, icon }) => (
          <button
            key={f}
            onClick={() => { router.push("/dashboard"); setFilter(f); }}
            className={cn(
              "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer",
              filter === f
                ? "bg-blue-600/20 text-accent"
                : "text-fg-muted hover:text-foreground hover:bg-hover"
            )}
          >
            <span className="flex items-center gap-2">
              {icon}
              {label}
            </span>
            <span className={cn(
              "text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center",
              filter === f ? "bg-blue-600/30 text-accent" : "bg-raise-strong text-fg-muted"
            )}>
              {counts[f]}
            </span>
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-line space-y-2">
        <div className={cn(
          "flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs",
          isError ? "text-negative" : "text-positive"
        )}>
          <span className="flex items-center gap-2">
            {isError ? <WifiOff className="h-3.5 w-3.5" /> : <Wifi className="h-3.5 w-3.5" />}
            {isError ? "Disconnected" : "Connected"}
          </span>
          {isError && (
            <button
              onClick={() => refetch()}
              title="Reconnect"
              className="p-1 rounded hover:bg-hover transition-colors cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <button
          onClick={() => setLogsOpen(true)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-fg-muted hover:text-foreground hover:bg-hover transition-colors cursor-pointer"
        >
          <Terminal className="h-4 w-4" />
          API Logs
        </button>
        <button
          onClick={() => router.push("/settings")}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-fg-muted hover:text-foreground hover:bg-hover transition-colors cursor-pointer"
        >
          <Settings className="h-4 w-4" />
          Settings
        </button>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-fg-muted hover:text-foreground hover:bg-hover transition-colors cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          Disconnect
        </button>
      </div>

      <RequestLogsDialog open={logsOpen} onClose={() => setLogsOpen(false)} />
    </div>
  );
}
