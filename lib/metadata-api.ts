import { TorrentMetadata, TorrentMetadataFile } from "./types";

/**
 * Client for the optional torrent metadata service.
 *
 * A magnet link carries no file list, so qbitUI asks an external endpoint for
 * it: the configured URL is called with the magnet as a `magnet` query
 * parameter and answers with the torrent's contents.
 *
 * Expected shape (extra fields are ignored):
 *   { "name": "…", "info_hash": "…", "total_size": 123,
 *     "files": [ { "path": "Folder/file.mkv", "size": 123 } ] }
 */
export interface MetadataApiFile {
  path: string;
  size: number;
}

export interface MetadataApiResponse {
  name?: string;
  info_hash?: string;
  piece_length?: number;
  pieces?: number;
  total_size?: number;
  file_count?: number;
  files?: MetadataApiFile[];
}

const REQUEST_TIMEOUT_MS = 30_000;

/** Validates a user-supplied endpoint and returns it without a trailing "?". */
export function validateMetadataApiUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new Error("Metadata API must be a full URL, e.g. https://example.com/metadata");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Metadata API URL must use http or https");
  }
  return parsed.toString();
}

/** Adds the magnet as a query parameter, keeping any the user already set. */
export function buildMetadataApiUrl(apiUrl: string, magnet: string): string {
  const url = new URL(validateMetadataApiUrl(apiUrl));
  url.searchParams.set("magnet", magnet);
  return url.toString();
}

export async function fetchMagnetMetadata(
  apiUrl: string,
  magnet: string
): Promise<TorrentMetadata> {
  const res = await fetch(buildMetadataApiUrl(apiUrl, magnet), {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Metadata API returned HTTP ${res.status}`);
  }

  let payload: MetadataApiResponse;
  try {
    payload = (await res.json()) as MetadataApiResponse;
  } catch {
    throw new Error("Metadata API did not return JSON");
  }

  return toTorrentMetadata(payload);
}

export function toTorrentMetadata(payload: MetadataApiResponse): TorrentMetadata {
  const files: TorrentMetadataFile[] = (payload.files ?? [])
    .filter((file) => typeof file?.path === "string" && file.path.length > 0)
    .map((file, index) => ({
      index,
      path: file.path,
      size: Number(file.size) || 0,
    }));

  if (files.length === 0) {
    throw new Error("Metadata API returned no files for this magnet link");
  }

  return {
    name: payload.name || files[0].path.split("/")[0],
    infoHash: payload.info_hash?.toLowerCase() ?? null,
    files,
    totalSize:
      Number(payload.total_size) || files.reduce((total, file) => total + file.size, 0),
    pieceLength: Number(payload.piece_length) || 0,
    private: false,
  };
}
