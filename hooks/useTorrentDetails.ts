"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PartialTorrentDetails, TorrentDetailsSection } from "@/lib/types";

async function fetchTorrentDetails(hash: string, sections: TorrentDetailsSection[]): Promise<PartialTorrentDetails> {
  const params = new URLSearchParams({ hash });
  for (const section of sections) {
    params.append("section", section);
  }
  const res = await fetch(`/api/torrents/details?${params.toString()}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Failed to fetch torrent details");
  }
  return res.json();
}

export function useTorrentDetails(hash: string | undefined, sections: TorrentDetailsSection[], refetchInterval: number | false = 5000) {
  const sectionsKey = sections.join(",");
  return useQuery<PartialTorrentDetails>({
    queryKey: ["torrent-details", hash, sectionsKey],
    queryFn: () => fetchTorrentDetails(hash as string, sections),
    enabled: Boolean(hash) && sections.length > 0,
    refetchInterval,
    refetchIntervalInBackground: true,
    staleTime: refetchInterval === false ? Infinity : Math.max(refetchInterval - 1_000, 0),
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
