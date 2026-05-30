"use client";

import { useMemo, useState } from "react";
import { Torrent } from "@/lib/types";
import {
  formatBytes,
  formatSpeed,
  formatETA,
  formatRatio,
  getStateLabel,
  getStateColor,
  cn,
} from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { MoreHorizontal } from "lucide-react";
import { useUIStore } from "@/store";
import { DeleteConfirmationDialog } from "./DeleteConfirmationDialog";
import {
  TorrentMenuItems,
  TorrentMenuPrimitives,
  useTorrentMenuActions,
} from "./TorrentMenuItems";

interface TorrentRowProps {
  torrent: Torrent;
}

const dropdownPrimitives: TorrentMenuPrimitives = {
  Item: DropdownMenuItem,
  Separator: DropdownMenuSeparator,
  Sub: DropdownMenuSub,
  SubTrigger: DropdownMenuSubTrigger,
  SubContent: DropdownMenuSubContent,
  Label: DropdownMenuLabel,
};

const contextPrimitives: TorrentMenuPrimitives = {
  Item: ContextMenuItem,
  Separator: ContextMenuSeparator,
  Sub: ContextMenuSub,
  SubTrigger: ContextMenuSubTrigger,
  SubContent: ContextMenuSubContent,
  Label: ContextMenuLabel,
};

export function TorrentRow({ torrent }: TorrentRowProps) {
  const { selectedHashes, toggleSelection, activeTorrentHash, setActiveTorrentHash } = useUIStore();
  const { deleteTorrents } = useTorrentMenuActions();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const isSelected = selectedHashes.has(torrent.hash);
  const isActive = activeTorrentHash === torrent.hash;

  // When the right-clicked row is part of a multi-selection, act on the whole
  // selection; otherwise act on just this row.
  const targetHashes = useMemo(() => {
    if (isSelected && selectedHashes.size > 1) return Array.from(selectedHashes);
    return [torrent.hash];
  }, [isSelected, selectedHashes, torrent.hash]);

  function handleDelete(deleteFiles: boolean) {
    setDeleteDialogOpen(false);
    deleteTorrents(targetHashes, deleteFiles);
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <tr
            className={cn(
              "group border-b border-white/5 hover:bg-white/3 transition-colors cursor-pointer",
              (isSelected || isActive) && "bg-blue-600/10"
            )}
            onClick={() => setActiveTorrentHash(torrent.hash)}
          >
            {/* Checkbox */}
            <td className="pl-3 pr-1 py-2 w-8">
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => toggleSelection(torrent.hash)}
                onClick={(e) => e.stopPropagation()}
              />
            </td>

            {/* Priority */}
            <td className="px-2 py-2 whitespace-nowrap text-sm text-gray-500 text-right tabular-nums">
              {torrent.priority > 0 ? torrent.priority : "—"}
            </td>

            {/* Name */}
            <td className="px-2 py-2 max-w-0">
              <div className="truncate text-sm text-white font-medium" title={torrent.name}>
                {torrent.name}
              </div>
              <div className="mt-1">
                <Progress value={torrent.progress * 100} className="h-1" />
              </div>
            </td>

            {/* State */}
            <td className="px-2 py-2 whitespace-nowrap">
              <Badge className={cn("text-xs border", getStateColor(torrent.state))}>
                {getStateLabel(torrent.state)}
              </Badge>
            </td>

            {/* Progress % */}
            <td className="px-2 py-2 whitespace-nowrap text-sm text-gray-300 text-right tabular-nums">
              {(torrent.progress * 100).toFixed(1)}%
            </td>

            {/* Size */}
            <td className="px-2 py-2 whitespace-nowrap text-sm text-gray-300 text-right tabular-nums">
              {formatBytes(torrent.size)}
            </td>

            {/* DL Speed */}
            <td className="px-2 py-2 whitespace-nowrap text-sm text-blue-400 text-right tabular-nums">
              {torrent.dlspeed > 0 ? formatSpeed(torrent.dlspeed) : "—"}
            </td>

            {/* UL Speed */}
            <td className="px-2 py-2 whitespace-nowrap text-sm text-green-400 text-right tabular-nums">
              {torrent.upspeed > 0 ? formatSpeed(torrent.upspeed) : "—"}
            </td>

            {/* ETA */}
            <td className="px-2 py-2 whitespace-nowrap text-sm text-gray-300 text-right tabular-nums">
              {formatETA(torrent.eta)}
            </td>

            {/* Ratio */}
            <td className="px-2 py-2 whitespace-nowrap text-sm text-gray-300 text-right tabular-nums">
              {formatRatio(torrent.ratio)}
            </td>

            {/* Seeds/Peers */}
            <td className="px-2 py-2 whitespace-nowrap text-sm text-gray-400 text-right tabular-nums">
              {torrent.num_seeds}/{torrent.num_leechs}
            </td>

            {/* Category */}
            <td className="px-2 py-2 whitespace-nowrap text-sm">
              {torrent.category ? (
                <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs border">
                  {torrent.category}
                </Badge>
              ) : (
                <span className="text-gray-600">—</span>
              )}
            </td>

            {/* Actions */}
            <td className="px-2 py-2 w-10">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10 cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-4 w-4 text-gray-400" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <TorrentMenuItems
                    primitives={dropdownPrimitives}
                    torrent={torrent}
                    targetHashes={targetHashes}
                    onRequestDelete={() => setDeleteDialogOpen(true)}
                  />
                </DropdownMenuContent>
              </DropdownMenu>
            </td>
          </tr>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <TorrentMenuItems
            primitives={contextPrimitives}
            torrent={torrent}
            targetHashes={targetHashes}
            onRequestDelete={() => setDeleteDialogOpen(true)}
          />
        </ContextMenuContent>
      </ContextMenu>

      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        torrentCount={targetHashes.length}
        torrentName={targetHashes.length === 1 ? torrent.name : undefined}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDelete}
      />
    </>
  );
}
