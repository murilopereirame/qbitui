"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Torrent } from "@/lib/types";
import { useTorrentAction } from "@/hooks/useTorrents";
import { toast } from "sonner";
import {
  Play,
  Pause,
  RefreshCw,
  Radio,
  ChevronsUp,
  ChevronsDown,
  ArrowUp,
  ArrowDown,
  Copy,
  FileDown,
  Trash2,
  ListOrdered,
  Type,
  Hash,
  Magnet,
  FolderOpen,
} from "lucide-react";

/**
 * The subset of Radix menu primitives shared by DropdownMenu and ContextMenu.
 * Both expose identical item APIs (`onSelect`), so a single menu body can be
 * rendered inside either container by passing the matching component set.
 */
export interface TorrentMenuPrimitives {
  Item: React.ComponentType<{
    onSelect?: (event: Event) => void;
    className?: string;
    disabled?: boolean;
    children?: React.ReactNode;
  }>;
  Separator: React.ComponentType<{ className?: string }>;
  Sub: React.ComponentType<{ children?: React.ReactNode }>;
  SubTrigger: React.ComponentType<{ className?: string; children?: React.ReactNode }>;
  SubContent: React.ComponentType<{ className?: string; children?: React.ReactNode }>;
  Label: React.ComponentType<{ className?: string; children?: React.ReactNode }>;
}

function buildMagnet(t: Torrent): string {
  if (t.magnet_uri) return t.magnet_uri;
  return `magnet:?xt=urn:btih:${t.hash}&dn=${encodeURIComponent(t.name)}`;
}

function torrentPath(t: Torrent): string {
  return t.content_path || t.save_path || "";
}

export function useTorrentMenuActions() {
  const { mutate: action } = useTorrentAction();
  const queryClient = useQueryClient();

  function resolveTorrents(hashes: string[]): Torrent[] {
    const all = queryClient.getQueryData<Torrent[]>(["torrents"]) ?? [];
    const wanted = new Set(hashes);
    return all.filter((t) => wanted.has(t.hash));
  }

  function runAction(act: Parameters<typeof action>[0]["action"], hashes: string[]) {
    action(
      { action: act, hashes },
      { onError: (e) => toast.error(e instanceof Error ? e.message : "Action failed") }
    );
  }

  function deleteTorrents(hashes: string[], deleteFiles: boolean) {
    action(
      { action: "delete", hashes, deleteFiles },
      { onError: (e) => toast.error(e instanceof Error ? e.message : "Action failed") }
    );
  }

  async function copyValue(label: string, value: string) {
    if (!value) {
      toast.error(`No ${label.toLowerCase()} to copy`);
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`Copied ${label}`);
    } catch {
      toast.error(`Failed to copy ${label.toLowerCase()}`);
    }
  }

  function copyField(
    hashes: string[],
    field: "name" | "hash" | "magnet" | "path",
    label: string
  ) {
    const torrents = resolveTorrents(hashes);
    const value = torrents
      .map((t) => {
        switch (field) {
          case "name":
            return t.name;
          case "hash":
            return t.hash;
          case "magnet":
            return buildMagnet(t);
          case "path":
            return torrentPath(t);
        }
      })
      .filter(Boolean)
      .join("\n");
    void copyValue(label, value);
  }

  function exportTorrent(torrent: Torrent) {
    const params = new URLSearchParams({ hash: torrent.hash, name: torrent.name });
    const link = document.createElement("a");
    link.href = `/api/torrents/export?${params}`;
    link.download = `${torrent.name}.torrent`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  return { runAction, deleteTorrents, copyField, exportTorrent };
}

interface TorrentMenuItemsProps {
  primitives: TorrentMenuPrimitives;
  /** The row the menu was opened on (used for single-target actions like export). */
  torrent: Torrent;
  /** Hashes the menu acts on — the whole selection when the row is selected. */
  targetHashes: string[];
  onRequestDelete: () => void;
}

export function TorrentMenuItems({
  primitives: P,
  torrent,
  targetHashes,
  onRequestDelete,
}: TorrentMenuItemsProps) {
  const { runAction, copyField, exportTorrent } = useTorrentMenuActions();
  const count = targetHashes.length;
  const isSingle = count <= 1;
  const isPaused = ["pausedDL", "pausedUP", "stoppedDL", "stoppedUP"].includes(torrent.state);

  return (
    <>
      {!isSingle && <P.Label>{count} torrents selected</P.Label>}

      {isSingle && isPaused ? (
        <P.Item onSelect={() => runAction("resume", targetHashes)}>
          <Play className="mr-2 h-4 w-4 text-positive" /> Resume
        </P.Item>
      ) : isSingle ? (
        <P.Item onSelect={() => runAction("pause", targetHashes)}>
          <Pause className="mr-2 h-4 w-4 text-warning" /> Pause
        </P.Item>
      ) : (
        <>
          <P.Item onSelect={() => runAction("resume", targetHashes)}>
            <Play className="mr-2 h-4 w-4 text-positive" /> Resume
          </P.Item>
          <P.Item onSelect={() => runAction("pause", targetHashes)}>
            <Pause className="mr-2 h-4 w-4 text-warning" /> Pause
          </P.Item>
        </>
      )}

      <P.Sub>
        <P.SubTrigger>
          <ListOrdered className="mr-2 h-4 w-4 text-fg-muted" /> Queue
        </P.SubTrigger>
        <P.SubContent>
          <P.Item onSelect={() => runAction("topPrio", targetHashes)}>
            <ChevronsUp className="mr-2 h-4 w-4 text-fg-muted" /> Move to top
          </P.Item>
          <P.Item onSelect={() => runAction("increasePrio", targetHashes)}>
            <ArrowUp className="mr-2 h-4 w-4 text-fg-muted" /> Move up
          </P.Item>
          <P.Item onSelect={() => runAction("decreasePrio", targetHashes)}>
            <ArrowDown className="mr-2 h-4 w-4 text-fg-muted" /> Move down
          </P.Item>
          <P.Item onSelect={() => runAction("bottomPrio", targetHashes)}>
            <ChevronsDown className="mr-2 h-4 w-4 text-fg-muted" /> Move to bottom
          </P.Item>
        </P.SubContent>
      </P.Sub>

      <P.Item onSelect={() => runAction("recheck", targetHashes)}>
        <RefreshCw className="mr-2 h-4 w-4 text-accent" /> Force recheck
      </P.Item>
      <P.Item onSelect={() => runAction("reannounce", targetHashes)}>
        <Radio className="mr-2 h-4 w-4 text-purple-500 dark:text-purple-400" /> Reannounce
      </P.Item>

      <P.Separator />

      <P.Sub>
        <P.SubTrigger>
          <Copy className="mr-2 h-4 w-4 text-fg-muted" /> Copy
        </P.SubTrigger>
        <P.SubContent>
          <P.Item onSelect={() => copyField(targetHashes, "name", "Name")}>
            <Type className="mr-2 h-4 w-4 text-fg-muted" /> Name
          </P.Item>
          <P.Item onSelect={() => copyField(targetHashes, "hash", "Hash")}>
            <Hash className="mr-2 h-4 w-4 text-fg-muted" /> Hash
          </P.Item>
          <P.Item onSelect={() => copyField(targetHashes, "magnet", "Magnet link")}>
            <Magnet className="mr-2 h-4 w-4 text-fg-muted" /> Magnet link
          </P.Item>
          <P.Item onSelect={() => copyField(targetHashes, "path", "Path")}>
            <FolderOpen className="mr-2 h-4 w-4 text-fg-muted" /> Path
          </P.Item>
        </P.SubContent>
      </P.Sub>

      <P.Item disabled={!isSingle} onSelect={() => exportTorrent(torrent)}>
        <FileDown className="mr-2 h-4 w-4 text-fg-muted" /> Export .torrent
      </P.Item>

      <P.Separator />

      <P.Item
        onSelect={() => onRequestDelete()}
        className="text-negative focus:text-negative"
      >
        <Trash2 className="mr-2 h-4 w-4" /> Delete
      </P.Item>
    </>
  );
}
