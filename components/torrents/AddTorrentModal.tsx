"use client";

import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useUIStore } from "@/store";
import { useAddTorrent } from "@/hooks/useTorrents";
import { cn } from "@/lib/utils";
import { Upload, Link, X, AlertCircle, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";

export function AddTorrentModal() {
  const { isAddModalOpen, setAddModalOpen } = useUIStore();
  const { addMagnet, addFile } = useAddTorrent();

  const [magnetText, setMagnetText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [savepath, setSavepath] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [paused, setPaused] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [magnetError, setMagnetError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setMagnetText("");
    setFiles([]);
    setSavepath("");
    setCategory("");
    setTags("");
    setPaused(false);
    setMagnetError("");
  }

  function handleClose() {
    setAddModalOpen(false);
    reset();
  }

  function parseMagnets(text: string): string[] {
    return text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("magnet:"));
  }

  async function handleAddMagnet() {
    const urls = parseMagnets(magnetText);
    if (urls.length === 0) {
      setMagnetError("No valid magnet links found. Each line should start with magnet:");
      return;
    }
    setMagnetError("");
    addMagnet.mutate(
      { urls, options: { savepath, category, tags, paused } },
      {
        onSuccess: () => {
          toast.success(`Added ${urls.length} magnet link${urls.length > 1 ? "s" : ""}`);
          handleClose();
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to add magnet"),
      }
    );
  }

  async function handleAddFiles() {
    if (files.length === 0) return;
    addFile.mutate(
      { files, options: { savepath, category, tags, paused } },
      {
        onSuccess: () => {
          toast.success(`Added ${files.length} torrent file${files.length > 1 ? "s" : ""}`);
          handleClose();
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to add file"),
      }
    );
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files).filter((f) =>
      f.name.endsWith(".torrent")
    );
    if (dropped.length === 0) {
      toast.error("Only .torrent files are supported");
      return;
    }
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name));
      return [...prev, ...dropped.filter((f) => !existing.has(f.name))];
    });
  }, []);

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []).filter((f) => f.name.endsWith(".torrent"));
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name));
      return [...prev, ...selected.filter((f) => !existing.has(f.name))];
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const sharedOptions = (
    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
      <div className="space-y-1.5">
        <Label>Save Path</Label>
        <Input placeholder="/downloads" value={savepath} onChange={(e) => setSavepath(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Category</Label>
        <Input placeholder="movies" value={category} onChange={(e) => setCategory(e.target.value)} />
      </div>
      <div className="space-y-1.5 col-span-2">
        <Label>Tags</Label>
        <Input placeholder="tag1, tag2" value={tags} onChange={(e) => setTags(e.target.value)} />
      </div>
      <div className="flex items-center gap-3 col-span-2">
        <Switch id="paused" checked={paused} onCheckedChange={setPaused} />
        <Label htmlFor="paused">Add as paused</Label>
      </div>
    </div>
  );

  return (
    <Dialog open={isAddModalOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Add Torrent</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="magnet">
          <TabsList className="w-full">
            <TabsTrigger value="magnet" className="flex-1 gap-2">
              <Link className="h-4 w-4" /> Magnet Link
            </TabsTrigger>
            <TabsTrigger value="file" className="flex-1 gap-2">
              <Upload className="h-4 w-4" /> Upload File
            </TabsTrigger>
          </TabsList>

          {/* Magnet tab */}
          <TabsContent value="magnet" className="space-y-4">
            <div className="space-y-1.5">
              <Label>Magnet Links</Label>
              <Textarea
                placeholder="magnet:?xt=urn:btih:..."
                value={magnetText}
                onChange={(e) => { setMagnetText(e.target.value); setMagnetError(""); }}
                className="min-h-[120px] font-mono text-xs"
              />
              <p className="text-xs text-gray-500">One magnet link per line</p>
              {magnetError && (
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {magnetError}
                </div>
              )}
            </div>
            {sharedOptions}
            <Button
              className="w-full"
              onClick={handleAddMagnet}
              disabled={addMagnet.isPending || !magnetText.trim()}
            >
              {addMagnet.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Add {parseMagnets(magnetText).length > 1 ? `${parseMagnets(magnetText).length} Magnets` : "Magnet"}
            </Button>
          </TabsContent>

          {/* File tab */}
          <TabsContent value="file" className="space-y-4">
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
                dragOver
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-white/10 hover:border-white/30 hover:bg-white/5"
              )}
            >
              <Upload className="mx-auto h-8 w-8 text-gray-500 mb-3" />
              <p className="text-sm text-gray-400">Drop <code>.torrent</code> files here or click to browse</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".torrent"
                multiple
                className="hidden"
                onChange={handleFileInput}
              />
            </div>

            {files.length > 0 && (
              <div className="space-y-1.5">
                <Label>Selected files ({files.length})</Label>
                <div className="max-h-36 overflow-y-auto space-y-1 rounded-lg border border-white/10 p-2">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-white/5 group">
                      <FileText className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                      <span className="text-xs text-gray-300 truncate flex-1">{f.name}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); setFiles((prev) => prev.filter((_, j) => j !== i)); }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5 text-gray-500 hover:text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sharedOptions}
            <Button
              className="w-full"
              onClick={handleAddFiles}
              disabled={addFile.isPending || files.length === 0}
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
