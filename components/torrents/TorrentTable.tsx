"use client";

import { useTorrents, useTorrentAction } from "@/hooks/useTorrents";
import { useUIStore } from "@/store";
import { TorrentRow } from "./TorrentRow";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { SortField } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChevronUp, ChevronDown, Loader2, Play, Pause, Trash2 } from "lucide-react";
import { toast } from "sonner";

const COLUMNS: { label: string; field?: SortField; className?: string }[] = [
  { label: "Name", field: "name", className: "min-w-[14rem]" },
  { label: "State", field: "state", className: "w-28" },
  { label: "%", field: "progress", className: "w-14 text-right" },
  { label: "Size", field: "size", className: "w-20 text-right" },
  { label: "DL", field: "dlspeed", className: "w-24 text-right" },
  { label: "UL", field: "upspeed", className: "w-24 text-right" },
  { label: "ETA", field: "eta", className: "w-20 text-right" },
  { label: "Ratio", field: "ratio", className: "w-16 text-right" },
  { label: "Seeds/Peers", field: "num_seeds", className: "w-24 text-right" },
  { label: "Category", field: "category", className: "w-28" },
  { label: "", className: "w-10" },
];

export function TorrentTable() {
  const { filteredTorrents, isLoading, isError, error } = useTorrents();
  const { sortField, sortDirection, toggleSort, selectedHashes, selectAll, clearSelection } = useUIStore();
  const { mutate: action } = useTorrentAction();

  const allSelected =
    filteredTorrents.length > 0 && filteredTorrents.every((t) => selectedHashes.has(t.hash));

  function toggleSelectAll() {
    if (allSelected) {
      clearSelection();
    } else {
      selectAll(filteredTorrents.map((t) => t.hash));
    }
  }

  function bulkAction(act: "pause" | "resume" | "delete") {
    const hashes = Array.from(selectedHashes);
    action(
      { action: act, hashes, deleteFiles: act === "delete" ? false : undefined },
      {
        onSuccess: () => {
          clearSelection();
          toast.success(`${act.charAt(0).toUpperCase() + act.slice(1)} applied to ${hashes.length} torrent(s)`);
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Action failed"),
      }
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
        <div className="text-red-400 font-medium">Failed to load torrents</div>
        <div className="text-sm text-gray-500">{error instanceof Error ? error.message : "Unknown error"}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Bulk action bar */}
      {selectedHashes.size > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-600/10 border-b border-blue-600/20 shrink-0">
          <span className="text-sm text-blue-300 font-medium mr-2">
            {selectedHashes.size} selected
          </span>
          <Button size="sm" variant="secondary" onClick={() => bulkAction("resume")} className="gap-1.5">
            <Play className="h-3.5 w-3.5" /> Resume
          </Button>
          <Button size="sm" variant="secondary" onClick={() => bulkAction("pause")} className="gap-1.5">
            <Pause className="h-3.5 w-3.5" /> Pause
          </Button>
          <Button size="sm" variant="destructive" onClick={() => bulkAction("delete")} className="gap-1.5">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
          <Button size="sm" variant="ghost" onClick={clearSelection} className="ml-auto">
            Clear
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm table-fixed">
          <thead className="sticky top-0 bg-gray-950 z-10">
            <tr className="border-b border-white/10">
              {/* Select all */}
              <th className="pl-3 pr-1 py-2.5 w-8">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleSelectAll}
                />
              </th>
              {COLUMNS.map(({ label, field, className }) => (
                <th
                  key={label || "actions"}
                  className={cn(
                    "px-2 py-2.5 text-left text-xs font-medium text-gray-400 select-none",
                    field && "cursor-pointer hover:text-white transition-colors",
                    className
                  )}
                  onClick={() => field && toggleSort(field)}
                >
                  <span className="flex items-center gap-1">
                    {label}
                    {field && sortField === field && (
                      sortDirection === "asc"
                        ? <ChevronUp className="h-3 w-3" />
                        : <ChevronDown className="h-3 w-3" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-white/5">
                  <td colSpan={12} className="px-3 py-3">
                    <div className="h-4 bg-white/5 rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : filteredTorrents.length === 0 ? (
              <tr>
                <td colSpan={12} className="text-center py-16 text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 opacity-20" />
                    <span>No torrents found</span>
                  </div>
                </td>
              </tr>
            ) : (
              filteredTorrents.map((torrent) => (
                <TorrentRow key={torrent.hash} torrent={torrent} />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-white/10 text-xs text-gray-500 shrink-0">
        {filteredTorrents.length} torrent{filteredTorrents.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
