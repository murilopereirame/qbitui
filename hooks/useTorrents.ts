"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Torrent, TorrentAction, AddTorrentOptions } from "@/lib/types";
import { useUIStore } from "@/store";
import { useMemo } from "react";

async function fetchTorrents(): Promise<Torrent[]> {
  const res = await fetch("/api/torrents");
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Failed to fetch torrents");
  }
  return res.json();
}

async function performAction(action: TorrentAction, hashes: string[], deleteFiles?: boolean) {
  const res = await fetch("/api/torrents/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, hashes, deleteFiles }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Action failed");
  }
  return res.json();
}

export function useTorrents() {
  const { filter, search, sortField, sortDirection } = useUIStore();

  const query = useQuery<Torrent[]>({
    queryKey: ["torrents"],
    queryFn: fetchTorrents,
    refetchInterval: 2000,
    staleTime: 1000,
  });

  const filtered = useMemo(() => {
    let data = query.data ?? [];

    if (filter !== "all") {
      data = data.filter((t) => {
        switch (filter) {
          case "downloading":
            return ["downloading", "stalledDL", "metaDL", "forcedDL", "queuedDL", "allocating", "pausedDL", "stoppedDL"].includes(t.state);
          case "seeding":
            return ["uploading", "stalledUP", "forcedUP", "queuedUP"].includes(t.state);
          case "paused":
            return ["pausedDL", "pausedUP", "stoppedDL", "stoppedUP"].includes(t.state);
          case "completed":
            return t.progress === 1 || ["uploading", "stalledUP", "forcedUP", "pausedUP", "queuedUP"].includes(t.state);
          case "error":
            return ["error", "missingFiles"].includes(t.state);
          default:
            return true;
        }
      });
    }

    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.category?.toLowerCase().includes(q) ||
          t.tags?.toLowerCase().includes(q)
      );
    }

    data = [...data].sort((a, b) => {
      const dir = sortDirection === "asc" ? 1 : -1;

      // Priority 0 means "no queue position" (unqueued/seeding); always sort last when ascending.
      if (sortField === "priority") {
        const aP = a.priority === 0 ? Infinity : a.priority;
        const bP = b.priority === 0 ? Infinity : b.priority;
        return (aP - bP) * dir;
      }

      const aVal = a[sortField as keyof Torrent];
      const bVal = b[sortField as keyof Torrent];

      if (typeof aVal === "string" && typeof bVal === "string") {
        return aVal.localeCompare(bVal) * dir;
      }
      if (typeof aVal === "number" && typeof bVal === "number") {
        return (aVal - bVal) * dir;
      }
      return 0;
    });

    return data;
  }, [query.data, filter, search, sortField, sortDirection]);

  return { ...query, filteredTorrents: filtered };
}

export function useTorrentAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ action, hashes, deleteFiles }: { action: TorrentAction; hashes: string[]; deleteFiles?: boolean }) =>
      performAction(action, hashes, deleteFiles),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["torrents"] });
    },
  });
}

export function useAddTorrent() {
  const queryClient = useQueryClient();

  const addMagnet = useMutation({
    mutationFn: async ({ urls, options }: { urls: string[]; options: AddTorrentOptions }) => {
      const res = await fetch("/api/torrents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls, ...options }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to add magnet");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["torrents"] });
    },
  });

  const addFile = useMutation({
    mutationFn: async ({ files, options }: { files: File[]; options: AddTorrentOptions }) => {
      const results = await Promise.allSettled(
        files.map(async (file) => {
          const form = new FormData();
          form.append("torrents", file, file.name);
          if (options.savepath) form.append("savepath", options.savepath);
          if (options.category) form.append("category", options.category);
          if (options.tags) form.append("tags", options.tags);
          if (options.paused) form.append("paused", "true");

          const res = await fetch("/api/torrents", {
            method: "POST",
            body: form,
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error ?? `Failed to add ${file.name}`);
          }
          return res.json();
        })
      );

      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length > 0) {
        throw new Error(`${failed.length} file(s) failed to upload`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["torrents"] });
    },
  });

  return { addMagnet, addFile };
}
