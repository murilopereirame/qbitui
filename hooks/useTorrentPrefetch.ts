"use client";

import { useMutation } from "@tanstack/react-query";
import { PrefetchedTorrent } from "@/lib/types";

export interface PrefetchResult {
  torrents: PrefetchedTorrent[];
  failed: { id: string; error: string }[];
}

async function post(body: BodyInit, headers?: HeadersInit): Promise<PrefetchResult> {
  const res = await fetch("/api/torrents/prefetch", { method: "POST", body, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Failed to read torrent metadata");
  return data as PrefetchResult;
}

/**
 * Reads the contents of torrents before they are queued.  `.torrent` files are
 * parsed server-side; magnet links have no local file list, so they are looked
 * up through the metadata API configured in Settings.
 */
export function useTorrentPrefetch() {
  const prefetchFiles = useMutation({
    mutationFn: async (files: File[]) => {
      const form = new FormData();
      for (const file of files) form.append("torrents", file, file.name);
      return post(form);
    },
  });

  const prefetchMagnets = useMutation({
    mutationFn: async ({ magnets, metadataApi }: { magnets: string[]; metadataApi: string }) =>
      post(JSON.stringify({ magnets, metadataApi }), { "Content-Type": "application/json" }),
  });

  return { prefetchFiles, prefetchMagnets };
}
