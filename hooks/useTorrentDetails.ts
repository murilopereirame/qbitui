"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TorrentDetails } from "@/lib/types";

async function fetchTorrentDetails(hash: string): Promise<TorrentDetails> {
  const res = await fetch(`/api/torrents/details?hash=${encodeURIComponent(hash)}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Failed to fetch torrent details");
  }
  return res.json();
}

export function useTorrentDetails(hash?: string) {
  return useQuery<TorrentDetails>({
    queryKey: ["torrent-details", hash],
    queryFn: () => fetchTorrentDetails(hash as string),
    enabled: Boolean(hash),
    refetchInterval: 5000,
    staleTime: 2000,
  });
}

export function useSetTorrentFilePriority() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ hash, fileIds, priority }: { hash: string; fileIds: number[]; priority: number }) => {
      const res = await fetch("/api/torrents/file-priority", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hash, fileIds, priority }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to set file priority");
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["torrent-details", variables.hash] });
      queryClient.invalidateQueries({ queryKey: ["torrents"] });
    },
  });
}
