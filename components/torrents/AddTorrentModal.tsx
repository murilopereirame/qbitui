"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useUIStore } from "@/store";
import { useAddTorrent } from "@/hooks/useTorrents";
import { useCategories, useTags } from "@/hooks/useTaxonomy";
import { useTorrentPrefetch } from "@/hooks/useTorrentPrefetch";
import { useMetadataApi } from "@/hooks/useMetadataApi";
import { TorrentContentSelector } from "./TorrentContentSelector";
import { PrefetchedTorrent } from "@/lib/types";
import { cn } from "@/lib/utils";
import NextLink from "next/link";
import { Upload, Link, X, AlertCircle, Loader2, FileText, ListTree } from "lucide-react";
import { toast } from "sonner";

/** Selected file paths, keyed by PrefetchedTorrent.id. */
type Selection = Record<string, Set<string>>;

function selectAllPaths(torrents: PrefetchedTorrent[], previous: Selection): Selection {
  const next: Selection = { ...previous };
  for (const torrent of torrents) {
    next[torrent.id] = new Set(torrent.files.map((file) => file.path));
  }
  return next;
}

/** The tag names currently typed into the comma-separated tags field. */
function splitTags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function excludedPathsFor(torrent: PrefetchedTorrent, selection: Selection): string[] {
  const selected = selection[torrent.id];
  if (!selected) return [];
  return torrent.files.map((file) => file.path).filter((path) => !selected.has(path));
}

export function AddTorrentModal() {
  const {
    isAddModalOpen, setAddModalOpen,
    pendingMagnet, setPendingMagnet,
    pendingTorrentFile, setPendingTorrentFile,
  } = useUIStore();
  const { addMagnet, addFile } = useAddTorrent();
  const { prefetchFiles, prefetchMagnets } = useTorrentPrefetch();
  const { url: metadataApi } = useMetadataApi();
  const { data: categories } = useCategories();
  const { data: knownTags } = useTags();

  const [activeTab, setActiveTab] = useState<"magnet" | "file">("magnet");
  const [magnetText, setMagnetText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [savepath, setSavepath] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [paused, setPaused] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [magnetError, setMagnetError] = useState("");
  // Torrents whose contents are known, keyed by tab.
  const [fileContents, setFileContents] = useState<PrefetchedTorrent[]>([]);
  const [magnetContents, setMagnetContents] = useState<PrefetchedTorrent[]>([]);
  const [selection, setSelection] = useState<Selection>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const contents = activeTab === "magnet" ? magnetContents : fileContents;
  const isBusy = addMagnet.isPending || addFile.isPending;

  const readContents = useCallback(
    async (chosen: File[]) => {
      try {
        const result = await prefetchFiles.mutateAsync(chosen);
        for (const failure of result.failed) {
          toast.error(`${failure.id}: ${failure.error}`);
        }
        if (result.torrents.length > 0) {
          setFileContents((prev) => [
            ...prev.filter((entry) => !result.torrents.some((added) => added.id === entry.id)),
            ...result.torrents,
          ]);
          setSelection((prev) => selectAllPaths(result.torrents, prev));
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to read torrent contents");
      }
    },
    [prefetchFiles]
  );

  const addChosenFiles = useCallback(
    (chosen: File[]) => {
      const existing = new Set(files.map((file) => file.name));
      const accepted = chosen.filter((file) => !existing.has(file.name));
      if (accepted.length === 0) return;
      setFiles((prev) => [
        ...prev,
        ...accepted.filter((file) => !prev.some((entry) => entry.name === file.name)),
      ]);
      void readContents(accepted);
    },
    [files, readContents]
  );

  const openPendingFile = useCallback((pending: { name: string; data: string }) => {
    try {
      const bytes = Uint8Array.from(atob(pending.data), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/x-bittorrent" });
      const file = new File([blob], pending.name, { type: "application/x-bittorrent" });
      addChosenFiles([file]);
      setActiveTab("file");
    } catch {
      toast.error(`Failed to open torrent file: ${pending.name}`);
    }
  }, [addChosenFiles]);

  // Consume a pending magnet URL stored by ElectronProtocolHandler.
  useEffect(() => {
    if (!pendingMagnet) return;
    const mag = pendingMagnet;
    void (async () => {
      setMagnetText(mag);
      setActiveTab("magnet");
      setPendingMagnet(null);
    })();
  }, [pendingMagnet, setPendingMagnet]);

  // Consume a pending .torrent file stored by ElectronProtocolHandler.
  useEffect(() => {
    if (!pendingTorrentFile) return;
    const file = pendingTorrentFile;
    void (async () => {
      openPendingFile(file);
      setPendingTorrentFile(null);
    })();
  }, [pendingTorrentFile, openPendingFile, setPendingTorrentFile]);

  function reset() {
    setMagnetText("");
    setFiles([]);
    setSavepath("");
    setCategory("");
    setTags("");
    setPaused(false);
    setMagnetError("");
    setFileContents([]);
    setMagnetContents([]);
    setSelection({});
  }

  function handleClose() {
    setAddModalOpen(false);
    reset();
  }

  function options() {
    return { savepath, category, tags, paused };
  }

  function reportWarnings(warnings: string[]) {
    for (const warning of warnings) toast.warning(warning);
  }

  function parseMagnets(text: string): string[] {
    return text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("magnet:"));
  }

  async function handleFetchMagnetContents() {
    const urls = parseMagnets(magnetText).filter(
      (url) => !magnetContents.some((entry) => entry.id === url)
    );
    if (urls.length === 0) {
      setMagnetError("No new magnet links found. Each line should start with magnet:");
      return;
    }
    setMagnetError("");
    try {
      const result = await prefetchMagnets.mutateAsync({ magnets: urls, metadataApi });
      for (const failure of result.failed) toast.error(failure.error);
      if (result.torrents.length > 0) {
        setMagnetContents((prev) => [...prev, ...result.torrents]);
        setSelection((prev) => selectAllPaths(result.torrents, prev));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to fetch metadata");
    }
  }

  async function handleAddMagnet() {
    const urls = parseMagnets(magnetText);
    if (urls.length === 0) {
      setMagnetError("No valid magnet links found. Each line should start with magnet:");
      return;
    }
    setMagnetError("");

    // Magnets whose contents were listed carry the user's file selection.
    const excludedPaths: Record<string, string[]> = {};
    for (const torrent of magnetContents) {
      const excluded = excludedPathsFor(torrent, selection);
      if (excluded.length > 0) excludedPaths[torrent.id] = excluded;
    }

    addMagnet.mutate(
      { urls, options: options(), excludedPaths },
      {
        onSuccess: (warnings) => {
          reportWarnings(warnings ?? []);
          toast.success(`Added ${urls.length} magnet link${urls.length > 1 ? "s" : ""}`);
          setAddModalOpen(false);
          reset();
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to add magnet"),
      }
    );
  }

  async function handleAddFiles() {
    if (files.length === 0) return;
    const excludedPaths: Record<string, string[]> = {};
    for (const torrent of fileContents) {
      const excluded = excludedPathsFor(torrent, selection);
      if (excluded.length > 0) excludedPaths[torrent.id] = excluded;
    }

    addFile.mutate(
      { files, options: options(), excludedPaths },
      {
        onSuccess: (warnings) => {
          reportWarnings(warnings ?? []);
          toast.success(`Added ${files.length} torrent file${files.length > 1 ? "s" : ""}`);
          setAddModalOpen(false);
          reset();
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to add file"),
      }
    );
  }

  function removeFile(name: string) {
    setFiles((prev) => prev.filter((file) => file.name !== name));
    setFileContents((prev) => prev.filter((entry) => entry.id !== name));
  }

  function removeMagnet(entry: PrefetchedTorrent) {
    setMagnetContents((prev) => prev.filter((item) => item.id !== entry.id));
    setMagnetText((prev) =>
      prev
        .split("\n")
        .filter((line) => line.trim() !== entry.id)
        .join("\n")
    );
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files).filter((f) => f.name.endsWith(".torrent"));
    if (dropped.length === 0) {
      toast.error("Only .torrent files are supported");
      return;
    }
    addChosenFiles(dropped);
  }, [addChosenFiles]);

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    addChosenFiles(Array.from(e.target.files ?? []).filter((f) => f.name.endsWith(".torrent")));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const contentSection = contents.length > 0 && (
    <div className="space-y-2">
      <Label>Contents</Label>
      <p className="text-xs text-fg-subtle">
        Deselected files are skipped — qBittorrent will not download them.
      </p>
      {contents.map((torrent) => (
        <TorrentContentSelector
          key={torrent.id}
          torrent={torrent}
          selected={selection[torrent.id] ?? new Set()}
          onChange={(next) => setSelection((prev) => ({ ...prev, [torrent.id]: next }))}
          onRemove={
            torrent.source === "magnet"
              ? () => removeMagnet(torrent)
              : () => removeFile(torrent.id)
          }
        />
      ))}
    </div>
  );

  const categoryNames = Object.keys(categories ?? {}).sort((a, b) => a.localeCompare(b));
  const selectedTags = splitTags(tags);

  /** Adds or removes a tag from the comma-separated tags field. */
  function toggleTag(tag: string) {
    const next = selectedTags.includes(tag)
      ? selectedTags.filter((entry) => entry !== tag)
      : [...selectedTags, tag];
    setTags(next.join(", "));
  }

  const sharedOptions = (
    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-line">
      <div className="space-y-1.5">
        <Label>Save Path</Label>
        <Input placeholder="/downloads" value={savepath} onChange={(e) => setSavepath(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Category</Label>
        <Input
          placeholder="movies"
          list="add-torrent-categories"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
        <datalist id="add-torrent-categories">
          {categoryNames.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        {category && !categoryNames.includes(category) && (
          <p className="text-xs text-fg-subtle">New category — qBittorrent creates it on add.</p>
        )}
      </div>
      <div className="space-y-1.5 col-span-2">
        <Label>Tags</Label>
        <Input placeholder="tag1, tag2" value={tags} onChange={(e) => setTags(e.target.value)} />
        {(knownTags?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {knownTags?.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-xs transition-colors cursor-pointer",
                  selectedTags.includes(tag)
                    ? "border-blue-500/40 bg-blue-600/20 text-accent"
                    : "border-line text-fg-muted hover:bg-hover hover:text-foreground"
                )}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 col-span-2">
        <Switch id="paused" checked={paused} onCheckedChange={setPaused} />
        <Label htmlFor="paused">Add as paused</Label>
      </div>
    </div>
  );

  const magnetCount = parseMagnets(magnetText).length;

  return (
    <Dialog open={isAddModalOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Add Torrent</DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "magnet" | "file")}
          className="flex flex-col min-h-0"
        >
          <TabsList className="w-full">
            <TabsTrigger value="magnet" className="flex-1 gap-2">
              <Link className="h-4 w-4" /> Magnet Link
            </TabsTrigger>
            <TabsTrigger value="file" className="flex-1 gap-2">
              <Upload className="h-4 w-4" /> Upload File
            </TabsTrigger>
          </TabsList>

          {/* Magnet tab */}
          <TabsContent value="magnet" className="space-y-4 flex-1 min-h-0 overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label>Magnet Links</Label>
              <Textarea
                placeholder="magnet:?xt=urn:btih:..."
                value={magnetText}
                onChange={(e) => { setMagnetText(e.target.value); setMagnetError(""); }}
                className="min-h-[120px] font-mono text-xs"
              />
              <p className="text-xs text-fg-subtle">One magnet link per line</p>
              {magnetError && (
                <div className="flex items-center gap-2 text-negative text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {magnetError}
                </div>
              )}
            </div>

            {metadataApi ? (
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={handleFetchMagnetContents}
                disabled={prefetchMagnets.isPending || isBusy || !magnetText.trim()}
              >
                {prefetchMagnets.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ListTree className="h-4 w-4" />
                )}
                {prefetchMagnets.isPending ? "Looking up files…" : "Fetch files to choose"}
              </Button>
            ) : (
              <p className="text-xs text-fg-subtle">
                Set a torrent metadata API in{" "}
                <NextLink href="/settings" className="text-accent hover:underline">
                  Settings
                </NextLink>{" "}
                to list a magnet link&apos;s files before adding it.
              </p>
            )}

            {contentSection}
            {sharedOptions}
            <Button
              className="w-full"
              onClick={handleAddMagnet}
              disabled={isBusy || prefetchMagnets.isPending || magnetCount === 0}
            >
              {isBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Add {magnetCount} {magnetCount === 1 ? "torrent" : "torrents"}
            </Button>
          </TabsContent>

          {/* File tab */}
          <TabsContent value="file" className="space-y-4 flex-1 min-h-0 overflow-y-auto pr-1">
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
                dragOver
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-line hover:border-line-strong hover:bg-hover"
              )}
            >
              <Upload className="mx-auto h-8 w-8 text-fg-subtle mb-3" />
              <p className="text-sm text-fg-muted">Drop <code>.torrent</code> files here or click to browse</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".torrent"
                multiple
                className="hidden"
                onChange={handleFileInput}
              />
            </div>

            {prefetchFiles.isPending && (
              <div className="flex items-center gap-2 text-xs text-fg-subtle">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading torrent contents…
              </div>
            )}

            {/* Files whose metadata could not be read still show up here. */}
            {files.filter((file) => !fileContents.some((entry) => entry.id === file.name)).length > 0 && (
              <div className="space-y-1.5">
                <Label>Selected files</Label>
                <div className="max-h-36 overflow-y-auto space-y-1 rounded-lg border border-line p-2">
                  {files
                    .filter((file) => !fileContents.some((entry) => entry.id === file.name))
                    .map((file) => (
                      <div key={file.name} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-hover group">
                        <FileText className="h-3.5 w-3.5 text-fg-subtle shrink-0" />
                        <span className="text-xs text-foreground truncate flex-1">{file.name}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeFile(file.name); }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5 text-fg-subtle hover:text-foreground" />
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {contentSection}
            {sharedOptions}
            <Button
              className="w-full"
              onClick={handleAddFiles}
              disabled={isBusy || files.length === 0}
            >
              {addFile.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Upload {files.length > 0 ? `${files.length} File${files.length > 1 ? "s" : ""}` : "Files"}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
