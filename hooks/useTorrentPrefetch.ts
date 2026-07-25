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
 * parsed server-side; magnets are staged in qBittorrent (added stopped) until
 * the user either confirms them or discards them.
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
    mutationFn: async (magnets: string[]) =>
      post(JSON.stringify({ magnets }), { "Content-Type": "application/json" }),
  });

  /** Removes magnets that were staged but never added. Best effort. */
  function discardStaged(hashes: string[]) {
    if (hashes.length === 0) return;
    const body = JSON.stringify({ hashes });
    // keepalive lets the request survive the dialog (or tab) going away.
    void fetch("/api/torrents/prefetch", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  }

  return { prefetchFiles, prefetchMagnets, discardStaged };
}
