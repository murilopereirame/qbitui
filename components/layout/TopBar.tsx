"use client";

import { Search, Plus, ArrowDown, ArrowUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/store";
import { useTransfer } from "@/hooks/useTransfer";
import { formatSpeed } from "@/lib/utils";

export function TopBar() {
  const { search, setSearch, setAddModalOpen } = useUIStore();
  const { data: transfer } = useTransfer();

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-white/10 bg-gray-950/30 shrink-0">
      {/* Search */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        <Input
          placeholder="Search torrents…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      {/* Speeds */}
      <div className="hidden sm:flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5 text-blue-400">
          <ArrowDown className="h-4 w-4" />
          <span className="font-mono">{transfer ? formatSpeed(transfer.dl_info_speed) : "— B/s"}</span>
        </div>
        <div className="flex items-center gap-1.5 text-green-400">
          <ArrowUp className="h-4 w-4" />
          <span className="font-mono">{transfer ? formatSpeed(transfer.up_info_speed) : "— B/s"}</span>
        </div>
      </div>

      {/* Add button */}
      <Button onClick={() => setAddModalOpen(true)} size="sm" className="gap-1.5 shrink-0">
        <Plus className="h-4 w-4" />
        Add Torrent
      </Button>
    </div>
  );
}
