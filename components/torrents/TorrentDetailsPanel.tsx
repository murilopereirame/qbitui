"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTorrents } from "@/hooks/useTorrents";
import { useTorrentDetails, useSetTorrentFilePriority } from "@/hooks/useTorrentDetails";
import { useUIStore } from "@/store";
import { calculateUploadedDownloadedRatio, formatBytes, formatDate, formatETA, formatRatio, formatSpeed } from "@/lib/utils";
import { TorrentFile } from "@/lib/types";
import { toast } from "sonner";

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
        priority: node.priorities.size > 1 ? "mixed" : [...node.priorities][0] ?? 0,
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
      aria-label={value === "mixed" ? "Mixed download priority (read-only)" : "Download priority"}
      className="bg-gray-900 border border-white/10 rounded px-2 py-1 text-xs"
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
  if (idx < 0 || idx === key.length - 1) return null;
  const fileId = Number(key.slice(idx + 1));
  return Number.isFinite(fileId) ? fileId : null;
}

export function TorrentDetailsPanel() {
  const { activeTorrentHash } = useUIStore();
  const { data: torrents } = useTorrents();
  const { data, isLoading, isError, error } = useTorrentDetails(activeTorrentHash);
  const { mutate: setPriority, isPending } = useSetTorrentFilePriority();
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());

  const selectedTorrent = useMemo(
    () => torrents?.find((t) => t.hash === activeTorrentHash),
    [torrents, activeTorrentHash]
  );
  const tree = useMemo(() => buildFileTree(data?.files ?? []), [data?.files]);
  const flatNodes = useMemo(() => flatten(tree), [tree]);

  function toggleNode(node: TreeNode) {
    const next = new Set(selectedNodes);
    const selected = next.has(node.key);
    for (const id of node.fileIds) {
      const key = makeSelectedFileKey(node.key, id);
      if (selected) next.delete(key);
      else next.add(key);
    }
    if (selected) next.delete(node.key);
    else next.add(node.key);
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
      <div className="h-72 border-t border-white/10 p-4 text-sm text-gray-500">
        Select a torrent to view details.
      </div>
    );
  }

  if (isLoading) {
    return <div className="h-72 border-t border-white/10 p-4 text-sm text-gray-500">Loading details…</div>;
  }

  if (isError || !data || !selectedTorrent) {
    return (
      <div className="h-72 border-t border-white/10 p-4 text-sm text-red-400">
        {error instanceof Error ? error.message : "Failed to load torrent details"}
      </div>
    );
  }

  const p = data.properties;
  const transferRows: Array<[string, string]> = [
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
  ];

  const infoRows: Array<[string, string]> = [
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
  ];

  return (
    <div className="h-80 border-t border-white/10 px-4 py-3 overflow-hidden">
      <div className="mb-2 text-sm text-white font-medium truncate">{selectedTorrent.name}</div>
      <Tabs defaultValue="transfer" className="h-full flex flex-col">
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
              <div key={k} className="flex justify-between gap-4 border-b border-white/5 py-1">
                <span className="text-gray-400">{k}</span>
                <span className="text-gray-200 text-right">{v}</span>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="info" className="h-full overflow-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1 text-sm">
            {infoRows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-white/5 py-1">
                <span className="text-gray-400">{k}</span>
                <span className="text-gray-200 text-right break-all">{v}</span>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="trackers" className="h-full overflow-auto">
          <table className="w-full text-xs">
            <thead className="text-gray-400 border-b border-white/10">
              <tr>
                <th className="text-left py-1">Tier</th>
                <th className="text-left py-1">URL</th>
                <th className="text-right py-1">Status</th>
                <th className="text-right py-1">Peers</th>
                <th className="text-right py-1">Seeds</th>
                <th className="text-right py-1">Leechers</th>
                <th className="text-right py-1">Downloaded</th>
                <th className="text-left py-1">Message</th>
              </tr>
            </thead>
            <tbody>
              {data.trackers.map((t) => (
                <tr key={t.url} className="border-b border-white/5">
                  <td className="py-1">{t.tier}</td>
                  <td className="py-1 truncate max-w-[20rem]" title={t.url}>{t.url}</td>
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
          <table className="w-full text-xs">
            <thead className="text-gray-400 border-b border-white/10">
              <tr>
                <th className="text-left py-1">Country</th>
                <th className="text-left py-1">IP</th>
                <th className="text-right py-1">Port</th>
                <th className="text-left py-1">Connection</th>
                <th className="text-left py-1">Flags</th>
                <th className="text-left py-1">Client</th>
                <th className="text-right py-1">Progress</th>
                <th className="text-right py-1">DL</th>
                <th className="text-right py-1">UL</th>
                <th className="text-right py-1">Downloaded</th>
                <th className="text-right py-1">Uploaded</th>
                <th className="text-right py-1">Ratio</th>
                <th className="text-left py-1">Files</th>
              </tr>
            </thead>
            <tbody>
              {data.peers.map((peer) => (
                <tr key={`${peer.ip}:${peer.port}`} className="border-b border-white/5">
                  <td className="py-1">{peer.country || "—"}</td>
                  <td className="py-1">{peer.ip}</td>
                  <td className="py-1 text-right">{peer.port}</td>
                  <td className="py-1">{peer.connection || "—"}</td>
                  <td className="py-1">{peer.flags || "—"}</td>
                  <td className="py-1">{peer.client || "—"}</td>
                  <td className="py-1 text-right">{(peer.progress * 100).toFixed(1)}%</td>
                  <td className="py-1 text-right">{formatSpeed(peer.dl_speed)}</td>
                  <td className="py-1 text-right">{formatSpeed(peer.up_speed)}</td>
                  <td className="py-1 text-right">{formatBytes(peer.downloaded)}</td>
                  <td className="py-1 text-right">{formatBytes(peer.uploaded)}</td>
                  <td className="py-1 text-right">{formatRatio(calculateUploadedDownloadedRatio(peer.uploaded, peer.downloaded))}</td>
                  <td className="py-1 truncate max-w-[10rem]" title={peer.files}>{peer.files || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabsContent>

        <TabsContent value="http" className="h-full overflow-auto">
          <ul className="text-sm space-y-1">
            {data.webSeeds.length === 0 ? (
              <li className="text-gray-500">No HTTP sources</li>
            ) : (
              data.webSeeds.map((url) => (
                <li key={url} className="truncate" title={url}>{url}</li>
              ))
            )}
          </ul>
        </TabsContent>

        <TabsContent value="content" className="h-full overflow-auto">
          <div className="flex items-center gap-2 mb-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={isPending || selectedFileIds().length === 0}
              onClick={() => applyPriority(selectedFileIds(), 1)}
            >
              Set selected: Normal
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={isPending || selectedFileIds().length === 0}
              onClick={() => applyPriority(selectedFileIds(), 0)}
            >
              Set selected: Do not download
            </Button>
            <span className="text-xs text-gray-500 ml-auto">{selectedFileIds().length} files selected</span>
          </div>
          <table className="w-full text-xs">
            <thead className="text-gray-400 border-b border-white/10">
              <tr>
                <th className="text-left py-1 w-8"></th>
                <th className="text-left py-1">Name</th>
                <th className="text-right py-1">Total Size</th>
                <th className="text-right py-1">Progress</th>
                <th className="text-left py-1">Download Priority</th>
                <th className="text-right py-1">Remaining</th>
                <th className="text-right py-1">Availability</th>
              </tr>
            </thead>
            <tbody>
              {flatNodes.map((node) => {
                const checked = selectedNodes.has(node.key);
                return (
                  <tr key={node.key} className="border-b border-white/5">
                    <td className="py-1">
                      <Checkbox checked={checked} onCheckedChange={() => toggleNode(node)} />
                    </td>
                    <td className="py-1" style={{ paddingLeft: `${node.depth * 14}px` }}>
                      <span className={node.isDir ? "font-medium text-gray-200" : "text-gray-300"}>
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
