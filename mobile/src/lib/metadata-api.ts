import { TorrentFile } from './types';

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
export interface MetadataApiResponse {
  name?: string;
  info_hash?: string;
  total_size?: number;
  files?: { path?: string; size?: number }[];
}

export interface MagnetMetadata {
  name: string;
  infoHash: string | null;
  totalSize: number;
  /** Shaped like qBittorrent's own file list so the same UI can render it. */
  files: TorrentFile[];
}

const REQUEST_TIMEOUT_MS = 30_000;

/** Validates a user-supplied endpoint and returns its normalised form. */
export function validateMetadataApiUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new Error('Metadata API must be a full URL, e.g. https://example.com/metadata');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Metadata API URL must use http or https');
  }
  return parsed.toString();
}

/** Adds the magnet as a query parameter, keeping any the user already set. */
export function buildMetadataApiUrl(apiUrl: string, magnet: string): string {
  const url = new URL(validateMetadataApiUrl(apiUrl));
  url.searchParams.set('magnet', magnet);
  return url.toString();
}

export async function fetchMagnetMetadata(
  apiUrl: string,
  magnet: string
): Promise<MagnetMetadata> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(buildMetadataApiUrl(apiUrl, magnet), {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) throw new Error(`Metadata API returned HTTP ${res.status}`);

  let payload: MetadataApiResponse;
  try {
    payload = (await res.json()) as MetadataApiResponse;
  } catch {
    throw new Error('Metadata API did not return JSON');
  }

  const files: TorrentFile[] = (payload.files ?? [])
    .filter((file) => typeof file?.path === 'string' && file.path.length > 0)
    .map((file, index) => ({
      index,
      name: file.path as string,
      size: Number(file.size) || 0,
      progress: 0,
      priority: 1,
      availability: 0,
    }));

  if (files.length === 0) {
    throw new Error('Metadata API returned no files for this magnet link');
  }

  return {
    name: payload.name || files[0].name.split('/')[0],
    infoHash: payload.info_hash?.toLowerCase() ?? null,
    totalSize: Number(payload.total_size) || files.reduce((total, file) => total + file.size, 0),
    files,
  };
}
