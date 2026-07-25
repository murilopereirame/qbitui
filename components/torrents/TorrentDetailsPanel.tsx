"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { useColumnResize } from "@/hooks/useColumnResize";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTorrents } from "@/hooks/useTorrents";
import { useTorrentDetails, useSetTorrentFilePriority } from "@/hooks/useTorrentDetails";
import { useUIStore } from "@/store";
import { calculateUploadedDownloadedRatio, formatBytes, formatDate, formatETA, formatRatio, formatSpeed } from "@/lib/utils";
import { TorrentDetailsSection, TorrentFile } from "@/lib/types";
import { toast } from "sonner";

type TorrentDetailsTab = "transfer" | "info" | "trackers" | "peers" | "http" | "content";

function getSectionsForTab(tab: TorrentDetailsTab): TorrentDetailsSection[] {
  switch (tab) {
    case "transfer":
    case "info":
      return ["properties"];
    case "trackers":
      return ["trackers"];
    case "peers":
      return ["peers"];
    case "http":
      return ["webSeeds"];
    case "content":
      return ["files"];
  }
}

type TreeNode = {
  key: string;
  name: string;
  depth: number;
  isDir: boolean;
  fileIds: number[];
  size: number;
  progress: number;
  remaining: number;
  availability: number;
  priority: number | "mixed";
  children: TreeNode[];
};

function buildFileTree(files: TorrentFile[]): TreeNode[] {
  type InternalNode = {
    key: string;
    name: string;
    depth: number;
    isDir: boolean;
    fileIds: number[];
    size: number;
    progress: number;
    remaining: number;
    availability: number;
    priorities: Set<number>;
    children: InternalNode[];
  };
  const roots = new Map<string, InternalNode>();

  function getOrCreateChild(map: Map<string, InternalNode>, key: string, name: string, depth: number, isDir: boolean) {
    const existing = map.get(key);
    if (existing) return existing;
    const node: InternalNode = {
      key,
      name,
      depth,
      isDir,
      fileIds: [],
      size: 0,
      progress: 0,
      remaining: 0,
      availability: 0,
      children: [],
      priorities: new Set<number>(),
    };
    map.set(key, node);
    return node;
  }

  const nodeMap = new Map<string, InternalNode>();

  for (const file of files) {
    const parts = file.name.split("/").filter(Boolean);
    let currentChildren = roots;
    const ancestors: InternalNode[] = [];

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const path = parts.slice(0, i + 1).join("/");
      const isLeaf = i === parts.length - 1;
      const node = getOrCreateChild(currentChildren, path, part, i, !isLeaf);
      if (!nodeMap.has(path)) {
        nodeMap.set(path, node);
        if (ancestors.length > 0) {
          ancestors[ancestors.length - 1].children.push(node);
        }
      }

      node.fileIds.push(file.index);
      node.size += file.size;
      node.progress += file.progress * file.size;
      node.remaining += file.size * (1 - file.progress);
      node.availability += file.availability;
      node.priorities.add(file.priority);

      ancestors.push(node);
      currentChildren = new Map(node.children.map((child) => [child.key, child]));
    }
  }

  function finalize(nodes: InternalNode[]): TreeNode[] {
    return nodes
      .sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name))
      .map((node) => ({
        key: node.key,
        name: node.name,
        depth: node.depth,
        isDir: node.isDir,
        fileIds: [...new Set(node.fileIds)],
        size: node.size,
        progress: node.size > 0 ? node.progress / node.size : 0,
        remaining: node.remaining,
        availability: node.fileIds.length > 0 ? node.availability / node.fileIds.length : 0,
        priority: node.priorities.size > 1 ? "mixed" : node.priorities.values().next().value ?? 0,
        children: finalize(node.children as InternalNode[]),
      }));
  }

  return finalize(Array.from(roots.values()));
}

function flatten(nodes: TreeNode[]): TreeNode[] {
  const result: TreeNode[] = [];
  function walk(node: TreeNode) {
    result.push(node);
    node.children.forEach(walk);
  }
  nodes.forEach(walk);
  return result;
}

function PrioritySelect({
  value,
  onChange,
}: {
  value: number | "mixed";
  onChange: (priority: number) => void;
}) {
  return (
    <select
      aria-label="Download priority"
      className="bg-surface border border-line rounded px-2 py-1 text-xs"
      value={typeof value === "number" ? String(value) : "mixed"}
      onChange={(e) => {
        const v = e.target.value;
        if (v !== "mixed") onChange(Number(v));
      }}
    >
      <option value="mixed" disabled>Mixed</option>
      <option value="0">Do not download</option>
      <option value="1">Normal</option>
      <option value="6">High</option>
      <option value="7">Maximal</option>
    </select>
  );
}

const selectedNodeKeySeparator = ":";

function makeSelectedFileKey(nodeKey: string, fileId: number): string {
  return `${nodeKey}${selectedNodeKeySeparator}${fileId}`;
}

function parseSelectedFileKey(key: string): number | null {
  const idx = key.lastIndexOf(selectedNodeKeySeparator);
  if (idx < 0 || idx + selectedNodeKeySeparator.length >= key.length) return null;
  const fileId = Number(key.slice(idx + selectedNodeKeySeparator.length));
  return Number.isFinite(fileId) ? fileId : null;
}

export function TorrentDetailsPanel() {
  const { activeTorrentHash } = useUIStore();
  const { data: torrents } = useTorrents();
  const [activeTab, setActiveTab] = useState<TorrentDetailsTab>("transfer");
  const { data, isLoading, isError, error } = useTorrentDetails(
    activeTorrentHash,
    getSectionsForTab(activeTab),
    activeTab === "content" ? false : 5000
  );
  const { mutate: setPriority, isPending } = useSetTorrentFilePriority();
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [bulkPriorityValue, setBulkPriorityValue] = useState("");
  const { widths: trackerWidths, startResize: startTrackerResize } = useColumnResize([50, 300, 80, 60, 60, 70, 90, 200]);
  const { widths: peerWidths, startResize: startPeerResize } = useColumnResize([70, 120, 50, 80, 60, 100, 70, 80, 80, 90, 80, 60, 120]);
  const { widths: contentWidths, startResize: startContentResize } = useColumnResize([300, 80, 70, 140, 80, 80]);

  // Resizable panel state
  const [panelHeight, setPanelHeight] = useState(320);
  const dragRef = useRef({ active: false, startY: 0, startHeight: 320 });

  // onDragStart creates new move/end closures each time a drag begins so there
  // are no circular useCallback dependencies and no ref mutations during render.
  function onDragStart(e: React.MouseEvent) {
    e.preventDefault();
    const startHeight = panelHeight;
    dragRef.current = { active: true, startY: e.clientY, startHeight };

    function onMove(ev: MouseEvent) {
      if (!dragRef.current.active) return;
      const delta = dragRef.current.startY - ev.clientY;
      const next = Math.max(120, Math.min(window.innerHeight * 0.75, dragRef.current.startHeight + delta));
      setPanelHeight(next);
    }

    function onEnd() {
      dragRef.current.active = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onEnd);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onEnd);
  }

  useEffect(() => {
    return () => {
      // Ensure drag listeners don't linger if the panel is unmounted mid-drag.
      dragRef.current.active = false;
    };
  }, []);

  const selectedTorrent = useMemo(
    () => torrents?.find((t) => t.hash === activeTorrentHash),
    [torrents, activeTorrentHash]
  );
  const tree = useMemo(
    () => (activeTab === "content" ? buildFileTree(data?.files ?? []) : []),
    [activeTab, data?.files]
  );
  const flatNodes = useMemo(() => flatten(tree), [tree]);

  function toggleNode(node: TreeNode) {
    const next = new Set(selectedNodes);
    const allSelected = node.fileIds.every((id) => next.has(makeSelectedFileKey(node.key, id)));
    for (const id of node.fileIds) {
      const key = makeSelectedFileKey(node.key, id);
      if (allSelected) next.delete(key);
      else next.add(key);
    }
    setSelectedNodes(next);
  }

  function selectedFileIds() {
    const ids = new Set<number>();
    for (const entry of selectedNodes) {
      const fileId = parseSelectedFileKey(entry);
      if (fileId !== null) ids.add(fileId);
    }
    return [...ids];
  }

  function applyPriority(fileIds: number[], priority: number) {
    if (!activeTorrentHash || fileIds.length === 0) return;
    setPriority(
      { hash: activeTorrentHash, fileIds, priority },
      {
        onSuccess: () => toast.success("File priority updated"),
        onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to update file priority"),
      }
    );
  }

  if (!activeTorrentHash) {
    return (
      <div
        className="border-t border-line p-4 text-sm text-fg-subtle shrink-0"
        style={{ height: panelHeight }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-1 cursor-row-resize hover:bg-blue-500/40 transition-colors"
          onMouseDown={onDragStart}
        />
        Select a torrent to view details.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className="relative border-t border-line p-4 text-sm text-fg-subtle shrink-0"
        style={{ height: panelHeight }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-1 cursor-row-resize hover:bg-blue-500/40 transition-colors"
          onMouseDown={onDragStart}
        />
        Loading details…
      </div>
    );
  }

  if (isError || !data || !selectedTorrent) {
    return (
      <div
        className="relative border-t border-line p-4 text-sm text-negative shrink-0"
        style={{ height: panelHeight }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-1 cursor-row-resize hover:bg-blue-500/40 transition-colors"
          onMouseDown={onDragStart}
        />
        {error instanceof Error ? error.message : "Failed to load torrent details"}
      </div>
    );
  }

  const p = data.properties;
  const transferRows: Array<[string, string]> = p ? [
    ["Time Active", formatETA(p.time_elapsed)],
    ["ETA", formatETA(p.eta)],
    ["Connections", `${p.nb_connections}/${p.nb_connections_limit}`],
    ["Downloaded", formatBytes(p.total_downloaded)],
    ["Uploaded", formatBytes(p.total_uploaded)],
    ["Seeds", `${p.seeds}/${p.seeds_total}`],
    ["Download Speed", formatSpeed(p.dl_speed)],
    ["Upload Speed", formatSpeed(p.up_speed)],
    ["Peers", `${p.peers}/${p.peers_total}`],
    ["Download Limit", p.dl_limit > 0 ? formatSpeed(p.dl_limit) : "∞"],
    ["Upload Limit", p.up_limit > 0 ? formatSpeed(p.up_limit) : "∞"],
    ["Wasted", formatBytes(p.total_wasted)],
    ["Share Ratio", formatRatio(p.share_ratio)],
    ["Reannounce In", formatETA(p.reannounce)],
    ["Last Seen Complete", formatDate(p.last_seen)],
    ["Popularity", p.popularity?.toFixed(2) ?? "—"],
  ] : [];

  const infoRows: Array<[string, string]> = p ? [
    ["Total Size", formatBytes(p.total_size)],
    ["Pieces", `${p.pieces_num} (${formatBytes(p.piece_size)})`],
    ["Created By", p.created_by || "—"],
    ["Added On", formatDate(p.addition_date)],
    ["Completed On", formatDate(p.completion_date)],
    ["Created On", formatDate(p.creation_date)],
    ["Private", p.private ? "Yes" : "No"],
    ["Info Hash v1", p.infohash_v1 || "—"],
    ["Info Hash v2", p.infohash_v2 || "—"],
    ["Save Path", p.save_path || "—"],
    ["Comment", p.comment || "—"],
  ] : [];

  return (
    <div
      className="relative border-t border-line px-4 py-3 overflow-hidden shrink-0"
      style={{ height: panelHeight }}
    >
      {/* Drag handle */}
      <div
        className="absolute top-0 left-0 right-0 h-1.5 cursor-row-resize hover:bg-blue-500/40 transition-colors group"
        onMouseDown={onDragStart}
        title="Drag to resize"
      >
        <div className="absolute inset-x-0 top-0 h-px bg-raise-strong group-hover:bg-blue-500/60 transition-colors" />
      </div>
      <div className="mb-2 text-sm text-foreground font-medium truncate">{selectedTorrent.name}</div>
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TorrentDetailsTab)} className="h-full flex flex-col">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="transfer">Transfer</TabsTrigger>
          <TabsTrigger value="info">Information</TabsTrigger>
          <TabsTrigger value="trackers">Trackers</TabsTrigger>
          <TabsTrigger value="peers">Peers</TabsTrigger>
          <TabsTrigger value="http">HTTP Sources</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
        </TabsList>

        <TabsContent value="transfer" className="h-full overflow-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1 text-sm">
            {transferRows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-line-soft py-1">
                <span className="text-fg-muted">{k}</span>
                <span className="text-foreground text-right">{v}</span>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="info" className="h-full overflow-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1 text-sm">
            {infoRows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-line-soft py-1">
                <span className="text-fg-muted">{k}</span>
                <span className="text-foreground text-right break-all">{v}</span>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="trackers" className="h-full overflow-auto">
          <table
            className="text-xs"
            style={{ tableLayout: "fixed", width: "100%", minWidth: trackerWidths.reduce((a, b) => a + b, 0) }}
          >
            <colgroup>
              {trackerWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
            </colgroup>
            <thead className="text-fg-muted border-b border-line">
              <tr>
                {(["Tier", "URL", "Status", "Peers", "Seeds", "Leechers", "Downloaded", "Message"] as const).map((label, i) => (
                  <th key={label} className={`py-1 relative select-none ${i >= 2 && i <= 6 ? "text-right" : "text-left"}`}>
                    {label}
                    {i < 7 && (
                      <div
                        className="absolute inset-y-0 right-0 w-3 cursor-col-resize hover:bg-blue-500/30 z-10"
                        onMouseDown={(e) => startTrackerResize(i, e)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data.trackers ?? []).map((t) => (
                <tr key={t.url} className="border-b border-line-soft">
                  <td className="py-1">{t.tier}</td>
                  <td className="py-1 truncate" title={t.url}>{t.url}</td>
                  <td className="py-1 text-right">{t.status}</td>
                  <td className="py-1 text-right">{t.num_peers}</td>
                  <td className="py-1 text-right">{t.num_seeds}</td>
                  <td className="py-1 text-right">{t.num_leeches}</td>
                  <td className="py-1 text-right">{t.num_downloaded}</td>
                  <td className="py-1">{t.msg || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabsContent>

        <TabsContent value="peers" className="h-full overflow-auto">
          <table
            className="text-xs"
            style={{ tableLayout: "fixed", width: "100%", minWidth: peerWidths.reduce((a, b) => a + b, 0) }}
          >
            <colgroup>
              {peerWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
            </colgroup>
            <thead className="text-fg-muted border-b border-line">
              <tr>
                {([
                  ["Country", false], ["IP", false], ["Port", true], ["Connection", false],
                  ["Flags", false], ["Client", false], ["Progress", true], ["DL", true],
                  ["UL", true], ["Downloaded", true], ["Uploaded", true], ["Ratio", true], ["Files", false],
                ] as [string, boolean][]).map(([label, right], i) => (
                  <th key={label} className={`py-1 relative select-none ${right ? "text-right" : "text-left"}`}>
                    {label}
                    {i < 12 && (
                      <div
                        className="absolute inset-y-0 right-0 w-3 cursor-col-resize hover:bg-blue-500/30 z-10"
                        onMouseDown={(e) => startPeerResize(i, e)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data.peers ?? []).map((peer) => (
                <tr key={`${peer.ip}:${peer.port}`} className="border-b border-line-soft">
                  <td className="py-1">{peer.country || "—"}</td>
                  <td className="py-1 truncate">{peer.ip}</td>
                  <td className="py-1 text-right">{peer.port}</td>
                  <td className="py-1 truncate">{peer.connection || "—"}</td>
                  <td className="py-1">{peer.flags || "—"}</td>
                  <td className="py-1 truncate">{peer.client || "—"}</td>
                  <td className="py-1 text-right">{(peer.progress * 100).toFixed(1)}%</td>
                  <td className="py-1 text-right">{formatSpeed(peer.dl_speed)}</td>
                  <td className="py-1 text-right">{formatSpeed(peer.up_speed)}</td>
                  <td className="py-1 text-right">{formatBytes(peer.downloaded)}</td>
                  <td className="py-1 text-right">{formatBytes(peer.uploaded)}</td>
                  <td className="py-1 text-right">{formatRatio(calculateUploadedDownloadedRatio(peer.uploaded, peer.downloaded))}</td>
                  <td className="py-1 truncate" title={peer.files}>{peer.files || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabsContent>

        <TabsContent value="http" className="h-full overflow-auto">
          <ul className="text-sm space-y-1">
            {(data.webSeeds ?? []).length === 0 ? (
              <li className="text-fg-subtle">No HTTP sources</li>
            ) : (
              (data.webSeeds ?? []).map((url) => (
                <li key={url} className="truncate" title={url}>{url}</li>
              ))
            )}
          </ul>
        </TabsContent>

        <TabsContent value="content" className="h-full overflow-auto">
          <div className="flex items-center gap-2 mb-2">
            <select
              className="bg-surface border border-line rounded px-2 py-1 text-xs disabled:opacity-40 cursor-pointer"
              value={bulkPriorityValue}
              disabled={isPending || selectedFileIds().length === 0}
              onChange={(e) => {
                const val = e.target.value;
                if (val !== "") {
                  applyPriority(selectedFileIds(), Number(val));
                  setBulkPriorityValue("");
                }
              }}
            >
              <option value="" disabled>Set selected priority…</option>
              <option value="0">Do not download</option>
              <option value="1">Normal</option>
              <option value="6">High</option>
              <option value="7">Maximal</option>
            </select>
            <span className="text-xs text-fg-subtle ml-auto">{selectedFileIds().length} files selected</span>
          </div>
          <table
            className="text-xs"
            style={{ tableLayout: "fixed", width: "100%", minWidth: 32 + contentWidths.reduce((a, b) => a + b, 0) }}
          >
            <colgroup>
              <col style={{ width: 32 }} />
              {contentWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
            </colgroup>
            <thead className="text-fg-muted border-b border-line">
              <tr>
                <th className="text-left py-1" />
                {([
                  ["Name", false], ["Total Size", true], ["Progress", true],
                  ["Download Priority", false], ["Remaining", true], ["Availability", true],
                ] as [string, boolean][]).map(([label, right], i) => (
                  <th key={label} className={`py-1 relative select-none ${right ? "text-right" : "text-left"}`}>
                    {label}
                    {i < 5 && (
                      <div
                        className="absolute inset-y-0 right-0 w-3 cursor-col-resize hover:bg-blue-500/30 z-10"
                        onMouseDown={(e) => startContentResize(i, e)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {flatNodes.map((node) => {
                const selectedCount = node.fileIds.filter((id) => selectedNodes.has(makeSelectedFileKey(node.key, id))).length;
                const checked = selectedCount === node.fileIds.length;
                const indeterminate = selectedCount > 0 && !checked;
                return (
                  <tr key={node.key} className="border-b border-line-soft">
                    <td className="py-1">
                      <Checkbox
                        checked={indeterminate ? "indeterminate" : checked}
                        onCheckedChange={() => toggleNode(node)}
                      />
                    </td>
                    <td className="py-1" style={{ paddingLeft: `${node.depth * 14}px` }}>
                      <span className={node.isDir ? "font-medium text-foreground" : "text-foreground"}>
                        {node.name}
                      </span>
                    </td>
                    <td className="py-1 text-right">{formatBytes(node.size)}</td>
                    <td className="py-1 text-right">{(node.progress * 100).toFixed(1)}%</td>
                    <td className="py-1">
                      <PrioritySelect value={node.priority} onChange={(priority) => applyPriority(node.fileIds, priority)} />
                    </td>
                    <td className="py-1 text-right">{formatBytes(node.remaining)}</td>
                    <td className="py-1 text-right">{node.availability.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TabsContent>
      </Tabs>
    </div>
  );
}
