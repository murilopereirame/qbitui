"use client";

import { useSyncExternalStore } from "react";
import {
  DEFAULT_METADATA_API,
  getMetadataApiSnapshot,
  getServerMetadataApiSnapshot,
  setMetadataApi,
  subscribeToMetadataApi,
} from "@/lib/settings";

/**
 * The configured torrent metadata endpoint, used to list a magnet link's files
 * before it is added.  Empty when the user has not set one up.
 */
export function useMetadataApi(): { url: string; setUrl: (url: string) => void } {
  const stored = useSyncExternalStore(
    subscribeToMetadataApi,
    getMetadataApiSnapshot,
    getServerMetadataApiSnapshot
  );
  return { url: stored || DEFAULT_METADATA_API, setUrl: setMetadataApi };
}
