"use client";

import { useState } from "react";
import { useTorrents, useTorrentAction } from "@/hooks/useTorrents";
import { useUIStore } from "@/store";
import { TorrentRow } from "./TorrentRow";
import { DeleteConfirmationDialog } from "./DeleteConfirmationDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { SortField } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChevronUp, ChevronDown, Loader2, Play, Pause, Trash2, ChevronsUp, ChevronsDown, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { useColumnResize } from "@/hooks/useColumnResize";

const COLUMNS: { label: string; field?: SortField; align?: "right" }[] = [
  { label: "#", field: "priority", align: "right" },
  { label: "Name", field: "name" },
  { label: "State", field: "state" },
  { label: "%", field: "progress", align: "right" },
  { label: "Size", field: "size", align: "right" },
  { label: "DL", field: "dlspeed", align: "right" },
  { label: "UL", field: "upspeed", align: "right" },
  { label: "ETA", field: "eta", align: "right" },
  { label: "Ratio", field: "ratio", align: "right" },
  { label: "Seeds/Peers", field: "num_seeds", align: "right" },
  { label: "Category", field: "category" },
  { label: "" },
];

const INITIAL_COL_WIDTHS = [40, 224, 112, 56, 80, 96, 96, 80, 64, 96, 112, 40];

export function TorrentTable() {
  const { filteredTorrents, isLoading, isError, error, data } = useTorrents();
  const { sortField, sortDirection, toggleSort, selectedHashes, selectAll, clearSelection } = useUIStore();
  const { mutate: action } = useTorrentAction();
  const { widths, startResize } = useColumnResize(INITIAL_COL_WIDTHS);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const singleSelectedName = selectedHashes.size === 1
    ? data?.find((t) => selectedHashes.has(t.hash))?.name
    : undefined;

  const allSelected =
    filteredTorrents.length > 0 && filteredTorrents.every((t) => selectedHashes.has(t.hash));

  function toggleSelectAll() {
    if (allSelected) {
      clearSelection();
    } else {
      selectAll(filteredTorrents.map((t) => t.hash));
    }
  }

  function bulkAction(act: "pause" | "resume" | "topPrio" | "increasePrio" | "decreasePrio" | "bottomPrio") {
    const hashes = Array.from(selectedHashes);
    action(
      { action: act, hashes },
      {
        onSuccess: () => {
          clearSelection();
          toast.success(`${act.charAt(0).toUpperCase() + act.slice(1)} applied to ${hashes.length} torrent(s)`);
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Action failed"),
      }
    );
  }

  function executeBulkDelete(deleteFiles: boolean) {
    const hashes = Array.from(selectedHashes);
    action(
      { action: "delete", hashes, deleteFiles },
      {
        onSuccess: () => {
          clearSelection();
          toast.success(`Deleted ${hashes.length} torrent(s)`);
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

  const totalWidth = 32 + widths.reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Bulk action bar — always visible */}
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-900/60 border-b border-white/10 shrink-0">
        {selectedHashes.size > 0 ? (
          <span className="text-sm text-blue-300 font-medium mr-2">
            {selectedHashes.size} selected
          </span>
        ) : (
          <span className="text-sm text-gray-600 mr-2">No torrents selected</span>
        )}
        <Button size="sm" variant="secondary" onClick={() => bulkAction("resume")} disabled={selectedHashes.size === 0} className="gap-1.5">
          <Play className="h-3.5 w-3.5" /> Resume
        </Button>
        <Button size="sm" variant="secondary" onClick={() => bulkAction("pause")} disabled={selectedHashes.size === 0} className="gap-1.5">
          <Pause className="h-3.5 w-3.5" /> Pause
        </Button>
        <Button size="sm" variant="secondary" onClick={() => bulkAction("topPrio")} disabled={selectedHashes.size === 0} className="gap-1.5">
          <ChevronsUp className="h-3.5 w-3.5" /> Top
        </Button>
        <Button size="sm" variant="secondary" onClick={() => bulkAction("increasePrio")} disabled={selectedHashes.size === 0} className="gap-1.5">
          <ArrowUp className="h-3.5 w-3.5" /> Up
        </Button>
        <Button size="sm" variant="secondary" onClick={() => bulkAction("decreasePrio")} disabled={selectedHashes.size === 0} className="gap-1.5">
          <ArrowDown className="h-3.5 w-3.5" /> Down
        </Button>
        <Button size="sm" variant="secondary" onClick={() => bulkAction("bottomPrio")} disabled={selectedHashes.size === 0} className="gap-1.5">
          <ChevronsDown className="h-3.5 w-3.5" /> Bottom
        </Button>
        <Button size="sm" variant="destructive" onClick={() => setBulkDeleteOpen(true)} disabled={selectedHashes.size === 0} className="gap-1.5">
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </Button>
        {selectedHashes.size > 0 && (
          <Button size="sm" variant="ghost" onClick={clearSelection} className="ml-auto">
            Clear
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table
          className="text-sm"
          style={{ tableLayout: "fixed", width: "100%", minWidth: totalWidth }}
        >
          <colgroup>
            <col style={{ width: 32 }} />
            {widths.map((w, i) => <col key={i} style={{ width: w }} />)}
          </colgroup>
          <thead className="sticky top-0 bg-gray-950 z-10">
            <tr className="border-b border-white/10">
              {/* Select all */}
              <th className="pl-3 pr-1 py-2.5 w-8">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleSelectAll}
                />
              </th>
              {COLUMNS.map(({ label, field, align }, i) => (
                <th
                  key={label || "actions"}
                  className={cn(
                    "px-2 py-2.5 text-xs font-medium text-gray-400 select-none relative overflow-visible",
                    align === "right" ? "text-right" : "text-left",
                    field && "cursor-pointer hover:text-white transition-colors",
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
                  {i < COLUMNS.length - 1 && (
                    <div
                      className="absolute inset-y-0 right-0 w-3 cursor-col-resize hover:bg-blue-500/30 z-20"
                      onMouseDown={(e) => startResize(i, e)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-white/5">
                  <td colSpan={13} className="px-3 py-3">
                    <div className="h-4 bg-white/5 rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : filteredTorrents.length === 0 ? (
              <tr>
                <td colSpan={13} className="text-center py-16 text-gray-500">
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

      <DeleteConfirmationDialog
        open={bulkDeleteOpen}
        torrentCount={selectedHashes.size}
        torrentName={singleSelectedName}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={(deleteFiles) => {
          setBulkDeleteOpen(false);
          executeBulkDelete(deleteFiles);
        }}
      />
    </div>
  );
}
