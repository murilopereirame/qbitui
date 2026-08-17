"use client";

import { useMemo, useState } from "react";
import { Torrent } from "@/lib/types";
import {
  CATEGORY_BADGE_COLOR,
  TAG_BADGE_COLOR,
  formatBytes,
  formatSpeed,
  formatETA,
  formatRatio,
  getStateLabel,
  getStateColor,
  parseTorrentTags,
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
import { CategoryDialog, TagDialog } from "./TaxonomyDialogs";
import { useTorrentTaxonomy } from "@/hooks/useTaxonomy";
import { toast } from "sonner";
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
  const { setCategory, addTags } = useTorrentTaxonomy();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const isSelected = selectedHashes.has(torrent.hash);
  const isActive = activeTorrentHash === torrent.hash;
  const tags = parseTorrentTags(torrent.tags);

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

  /** A category created from the menu is applied to whatever the menu targets. */
  function applyNewCategory(name: string) {
    setCategory.mutate(
      { hashes: targetHashes, category: name },
      { onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to set category") }
    );
  }

  function applyNewTags(tags: string[]) {
    addTags.mutate(
      { hashes: targetHashes, tags },
      { onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to add tags") }
    );
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <tr
            className={cn(
              "group border-b border-line-soft hover:bg-hover-soft transition-colors cursor-pointer",
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
            <td className="px-2 py-2 whitespace-nowrap text-sm text-fg-subtle text-right tabular-nums">
              {torrent.priority > 0 ? torrent.priority : "—"}
            </td>

            {/* Name */}
            <td className="px-2 py-2 max-w-0">
              <div className="truncate text-sm text-foreground font-medium" title={torrent.name}>
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
            <td className="px-2 py-2 whitespace-nowrap text-sm text-foreground text-right tabular-nums">
              {(torrent.progress * 100).toFixed(1)}%
            </td>

            {/* Size */}
            <td className="px-2 py-2 whitespace-nowrap text-sm text-foreground text-right tabular-nums">
              {formatBytes(torrent.size)}
            </td>

            {/* DL Speed */}
            <td className="px-2 py-2 whitespace-nowrap text-sm text-accent text-right tabular-nums">
              {torrent.dlspeed > 0 ? formatSpeed(torrent.dlspeed) : "—"}
            </td>

            {/* UL Speed */}
            <td className="px-2 py-2 whitespace-nowrap text-sm text-positive text-right tabular-nums">
              {torrent.upspeed > 0 ? formatSpeed(torrent.upspeed) : "—"}
            </td>

            {/* ETA */}
            <td className="px-2 py-2 whitespace-nowrap text-sm text-foreground text-right tabular-nums">
              {formatETA(torrent.eta)}
            </td>

            {/* Ratio */}
            <td className="px-2 py-2 whitespace-nowrap text-sm text-foreground text-right tabular-nums">
              {formatRatio(torrent.ratio)}
            </td>

            {/* Seeds/Peers */}
            <td className="px-2 py-2 whitespace-nowrap text-sm text-fg-muted text-right tabular-nums">
              {torrent.num_seeds}/{torrent.num_leechs}
            </td>

            {/* Category */}
            <td className="px-2 py-2 whitespace-nowrap text-sm">
              {torrent.category ? (
                <Badge className={cn("text-xs border", CATEGORY_BADGE_COLOR)}>
                  {torrent.category}
                </Badge>
              ) : (
                <span className="text-fg-subtle">—</span>
              )}
            </td>

            {/* Tags */}
            <td className="px-2 py-2 max-w-0">
              {tags.length > 0 ? (
                <div className="flex gap-1 overflow-hidden" title={tags.join(", ")}>
                  {tags.map((tag) => (
                    <Badge key={tag} className={cn("text-xs border shrink-0", TAG_BADGE_COLOR)}>
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : (
                <span className="text-fg-subtle text-sm">—</span>
              )}
            </td>

            {/* Actions */}
            <td className="px-2 py-2 w-10">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-hover cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-4 w-4 text-fg-muted" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <TorrentMenuItems
                    primitives={dropdownPrimitives}
                    torrent={torrent}
                    targetHashes={targetHashes}
                    onRequestDelete={() => setDeleteDialogOpen(true)}
                    onRequestNewCategory={() => setCategoryDialogOpen(true)}
                    onRequestNewTag={() => setTagDialogOpen(true)}
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
            onRequestNewCategory={() => setCategoryDialogOpen(true)}
            onRequestNewTag={() => setTagDialogOpen(true)}
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

      <CategoryDialog
        open={categoryDialogOpen}
        mode="create"
        onClose={() => setCategoryDialogOpen(false)}
        onSaved={applyNewCategory}
      />

      <TagDialog
        open={tagDialogOpen}
        onClose={() => setTagDialogOpen(false)}
        onCreated={applyNewTags}
      />
    </>
  );
}
