/**
 * Client-side preferences that are not part of the qBittorrent session.
 *
 * Kept in localStorage (so they survive logout) and read through
 * `useMetadataApi()`; the value is sent along with the requests that need it.
 */

export const METADATA_API_STORAGE_KEY = "qbitui-metadata-api";

const listeners = new Set<() => void>();

let cached: string | null = null;
let initialized = false;

function read(): string {
  try {
    return window.localStorage.getItem(METADATA_API_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function getMetadataApiSnapshot(): string {
  if (!initialized && typeof window !== "undefined") {
    cached = read();
    initialized = true;
  }
  return cached ?? "";
}

export function getServerMetadataApiSnapshot(): string {
  return "";
}

export function subscribeToMetadataApi(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setMetadataApi(url: string): void {
  const value = url.trim();
  cached = value;
  initialized = true;
  try {
    if (value) window.localStorage.setItem(METADATA_API_STORAGE_KEY, value);
    else window.localStorage.removeItem(METADATA_API_STORAGE_KEY);
  } catch {
    // Private browsing / disabled storage — the setting just won't persist.
  }
  for (const listener of listeners) listener();
}

/** Optional default so deployments can ship a metadata endpoint out of the box. */
export const DEFAULT_METADATA_API = process.env.NEXT_PUBLIC_DEFAULT_METADATA_API ?? "";
