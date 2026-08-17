"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Torrent } from "@/lib/types";
import { useTorrentAction, useTorrents } from "@/hooks/useTorrents";
import { useCategories, useTags, useTorrentTaxonomy } from "@/hooks/useTaxonomy";
import { parseTorrentTags } from "@/lib/utils";
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
  Check,
  Copy,
  FileDown,
  Folder,
  Plus,
  Tag,
  Trash2,
  ListOrdered,
  Type,
  Hash,
  Magnet,
  FolderOpen,
  X,
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
  /** Opens the "new category" dialog; the category is applied to the targets. */
  onRequestNewCategory: () => void;
  /** Opens the "new tag" dialog; the tags are applied to the targets. */
  onRequestNewTag: () => void;
}

export function TorrentMenuItems({
  primitives: P,
  torrent,
  targetHashes,
  onRequestDelete,
  onRequestNewCategory,
  onRequestNewTag,
}: TorrentMenuItemsProps) {
  const { runAction, copyField, exportTorrent } = useTorrentMenuActions();
  // Menu content is only mounted while the menu is open, so subscribing to the
  // torrent list here keeps the category/tag ticks live at no cost when closed.
  const { data: allTorrents } = useTorrents();
  const { data: categories } = useCategories();
  const { data: knownTags } = useTags();
  const { setCategory, addTags, removeTags } = useTorrentTaxonomy();
  const count = targetHashes.length;
  const isSingle = count <= 1;
  const isPaused = ["pausedDL", "pausedUP", "stoppedDL", "stoppedUP"].includes(torrent.state);

  const wanted = new Set(targetHashes);
  const targets = (allTorrents ?? []).filter((t) => wanted.has(t.hash));
  // Category names known to qBittorrent plus any the targets already carry.
  const categoryNames = [
    ...new Set([
      ...Object.keys(categories ?? {}),
      ...targets.map((t) => t.category).filter(Boolean),
    ]),
  ].sort((a, b) => a.localeCompare(b));
  const tagNames = [
    ...new Set([...(knownTags ?? []), ...targets.flatMap((t) => parseTorrentTags(t.tags))]),
  ].sort((a, b) => a.localeCompare(b));

  /** The shared category of every target, or undefined when they disagree. */
  const commonCategory = targets.every((t) => (t.category ?? "") === (targets[0]?.category ?? ""))
    ? targets[0]?.category ?? ""
    : undefined;
  const targetsHaveTag = (tag: string) =>
    targets.length > 0 && targets.every((t) => parseTorrentTags(t.tags).includes(tag));
  const hasAnyTag = targets.some((t) => parseTorrentTags(t.tags).length > 0);

  function assignCategory(category: string) {
    setCategory.mutate(
      { hashes: targetHashes, category },
      {
        onSuccess: () =>
          toast.success(category ? `Moved to "${category}"` : "Category cleared"),
        onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to set category"),
      }
    );
  }

  /** Adds the tag unless every target already carries it, in which case it is removed. */
  function toggleTag(tag: string) {
    const remove = targetsHaveTag(tag);
    const mutation = remove ? removeTags : addTags;
    mutation.mutate(
      { hashes: targetHashes, tags: [tag] },
      {
        onSuccess: () => toast.success(remove ? `Removed tag "${tag}"` : `Tagged "${tag}"`),
        onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to update tags"),
      }
    );
  }

  function clearTags() {
    const tags = [...new Set(targets.flatMap((t) => parseTorrentTags(t.tags)))];
    if (tags.length === 0) return;
    removeTags.mutate(
      { hashes: targetHashes, tags },
      {
        onSuccess: () => toast.success("Tags removed"),
        onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to remove tags"),
      }
    );
  }

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
          <Folder className="mr-2 h-4 w-4 text-purple-500 dark:text-purple-400" /> Category
        </P.SubTrigger>
        <P.SubContent className="max-h-72 overflow-y-auto">
          <P.Item onSelect={() => assignCategory("")}>
            <X className="mr-2 h-4 w-4 text-fg-muted" /> No category
            {commonCategory === "" && <Check className="ml-auto h-4 w-4 text-accent" />}
          </P.Item>
          {categoryNames.length > 0 && <P.Separator />}
          {categoryNames.map((name) => (
            <P.Item key={name} onSelect={() => assignCategory(name)}>
              <Folder className="mr-2 h-4 w-4 text-fg-muted" />
              <span className="truncate">{name}</span>
              {commonCategory === name && <Check className="ml-auto h-4 w-4 text-accent" />}
            </P.Item>
          ))}
          <P.Separator />
          <P.Item onSelect={() => onRequestNewCategory()}>
            <Plus className="mr-2 h-4 w-4 text-fg-muted" /> New category…
          </P.Item>
        </P.SubContent>
      </P.Sub>

      <P.Sub>
        <P.SubTrigger>
          <Tag className="mr-2 h-4 w-4 text-cyan-500 dark:text-cyan-400" /> Tags
        </P.SubTrigger>
        <P.SubContent className="max-h-72 overflow-y-auto">
          {tagNames.length === 0 && <P.Label>No tags yet</P.Label>}
          {tagNames.map((tag) => (
            <P.Item key={tag} onSelect={() => toggleTag(tag)}>
              <Tag className="mr-2 h-4 w-4 text-fg-muted" />
              <span className="truncate">{tag}</span>
              {targetsHaveTag(tag) && <Check className="ml-auto h-4 w-4 text-accent" />}
            </P.Item>
          ))}
          <P.Separator />
          <P.Item onSelect={() => onRequestNewTag()}>
            <Plus className="mr-2 h-4 w-4 text-fg-muted" /> New tag…
          </P.Item>
          <P.Item disabled={!hasAnyTag} onSelect={() => clearTags()}>
            <X className="mr-2 h-4 w-4 text-fg-muted" /> Remove all tags
          </P.Item>
        </P.SubContent>
      </P.Sub>

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
