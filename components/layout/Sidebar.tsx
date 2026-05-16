"use client";

import { useRouter } from "next/navigation";
import {
  Download,
  Upload,
  List,
  Pause,
  CheckCircle,
  AlertTriangle,
  LayoutDashboard,
  LogOut,
  Wifi,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TorrentFilter } from "@/lib/types";
import { useUIStore } from "@/store";
import { useTorrents } from "@/hooks/useTorrents";

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
  const { data, isError } = useTorrents();

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
    <div className="flex h-full w-56 flex-col border-r border-white/10 bg-gray-950/50">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-white/10">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
          <LayoutDashboard className="h-4 w-4 text-white" />
        </div>
        <span className="font-bold text-white text-lg">qbitUI</span>
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
                ? "bg-blue-600/20 text-blue-400"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            )}
          >
            <span className="flex items-center gap-2">
              {icon}
              {label}
            </span>
            <span className={cn(
              "text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center",
              filter === f ? "bg-blue-600/30 text-blue-300" : "bg-white/10 text-gray-400"
            )}>
              {counts[f]}
            </span>
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-white/10 space-y-2">
        <div className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg text-xs",
          isError ? "text-red-400" : "text-green-400"
        )}>
          <Wifi className="h-3.5 w-3.5" />
          <span>{isError ? "Disconnected" : "Connected"}</span>
        </div>
        <button
          onClick={() => router.push("/settings")}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
        >
          <Settings className="h-4 w-4" />
          Settings
        </button>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          Disconnect
        </button>
      </div>
    </div>
  );
}
