"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, File, Folder, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { buildContentTree, visibleNodes, type ContentNode } from "@/lib/file-tree";
import { formatBytes, cn } from "@/lib/utils";
import { PrefetchedTorrent } from "@/lib/types";

interface Props {
  torrent: PrefetchedTorrent;
  /** Paths the user wants to download. */
  selected: Set<string>;
  onChange: (selected: Set<string>) => void;
  onRemove?: () => void;
}

/**
 * Shows the contents of a torrent whose metadata has been fetched, letting the
 * user pick which files to download before it is queued.
 */
export function TorrentContentSelector({ torrent, selected, onChange, onRemove }: Props) {
  const tree = useMemo(() => buildContentTree(torrent.files), [torrent.files]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const rows = useMemo(() => visibleNodes(tree, collapsed), [tree, collapsed]);

  const selectedSize = torrent.files
    .filter((file) => selected.has(file.path))
    .reduce((total, file) => total + file.size, 0);
  const allSelected = selected.size === torrent.files.length;

  function toggleNode(node: ContentNode) {
    const next = new Set(selected);
    const isFullySelected = node.filePaths.every((path) => next.has(path));
    for (const path of node.filePaths) {
      if (isFullySelected) next.delete(path);
      else next.add(path);
    }
    onChange(next);
  }

  function toggleAll() {
    onChange(allSelected ? new Set() : new Set(torrent.files.map((file) => file.path)));
  }

  function toggleCollapse(key: string) {
    const next = new Set(collapsed);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setCollapsed(next);
  }

  return (
    <div className="rounded-lg border border-line overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-raise">
        <Checkbox
          checked={allSelected ? true : selected.size > 0 ? "indeterminate" : false}
          onCheckedChange={toggleAll}
          aria-label={`Select all files in ${torrent.name}`}
        />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-foreground truncate" title={torrent.name}>
            {torrent.name}
          </div>
          <div className="text-[11px] text-fg-subtle">
            {selected.size} of {torrent.files.length} files · {formatBytes(selectedSize)} of{" "}
            {formatBytes(torrent.totalSize)}
            {torrent.source === "magnet" && " · from metadata API"}
          </div>
        </div>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-fg-subtle hover:text-foreground transition-colors cursor-pointer"
            aria-label={`Remove ${torrent.name}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="max-h-48 overflow-y-auto">
        {rows.map((node) => {
          const selectedCount = node.filePaths.filter((path) => selected.has(path)).length;
          const checked = selectedCount === node.filePaths.length;
          const indeterminate = selectedCount > 0 && !checked;
          return (
            <div
              key={node.key}
              className="flex items-center gap-2 px-3 py-1 hover:bg-hover-soft"
              style={{ paddingLeft: 12 + node.depth * 14 }}
            >
              <Checkbox
                checked={indeterminate ? "indeterminate" : checked}
                onCheckedChange={() => toggleNode(node)}
                aria-label={node.key}
              />
              {node.isDir ? (
                <button
                  type="button"
                  onClick={() => toggleCollapse(node.key)}
                  className="text-fg-subtle hover:text-foreground cursor-pointer"
                  aria-label={collapsed.has(node.key) ? `Expand ${node.name}` : `Collapse ${node.name}`}
                >
                  {collapsed.has(node.key) ? (
                    <ChevronRight className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>
              ) : (
                <span className="w-3.5" />
              )}
              {node.isDir ? (
                <Folder className="h-3.5 w-3.5 shrink-0 text-fg-subtle" />
              ) : (
                <File className="h-3.5 w-3.5 shrink-0 text-fg-subtle" />
              )}
              <span
                className={cn("truncate text-xs flex-1", node.isDir ? "font-medium" : "text-fg-muted")}
                title={node.name}
              >
                {node.name}
              </span>
              <span className="text-[11px] text-fg-subtle tabular-nums shrink-0">
                {formatBytes(node.size)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
