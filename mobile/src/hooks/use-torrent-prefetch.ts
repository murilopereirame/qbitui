import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useApi } from '@/hooks/use-qbit';
import { logger } from '@/lib/logger';
import { fetchMagnetMetadata } from '@/lib/metadata-api';
import { AddTorrentOptions, TorrentFile } from '@/lib/types';
import { magnetInfoHash } from '@/lib/utils';
import { useSettingsStore } from '@/store/settings';

/** Priority 0 means "do not download this file". */
const PRIORITY_SKIP = 0;

/** How long to wait for a stopped magnet's metadata before starting it. */
const STOPPED_METADATA_TIMEOUT_MS = 10_000;
const RUNNING_METADATA_TIMEOUT_MS = 60_000;

/**
 * A torrent whose contents are known but which has not been queued yet.
 *
 * `.torrent` files are staged — added to qBittorrent stopped, which gives it
 * the file list immediately.  Magnet links have no local metadata, so theirs
 * comes from the metadata API configured in Settings and nothing is added
 * until the user confirms.
 */
export interface TorrentContents {
  source: 'magnet' | 'file';
  name: string;
  totalSize: number;
  files: TorrentFile[];
  /** Set for staged .torrent files: the stopped torrent holding the metadata. */
  stagedHash?: string;
}

export type ContentsPayload =
  | { type: 'magnet'; url: string }
  | { type: 'file'; fileUri: string; fileName: string };

export interface ConfirmMagnetPayload {
  url: string;
  /** Paths the user deselected; they are set to "do not download". */
  excludedPaths: string[];
  options: AddTorrentOptions;
}

export interface ConfirmStagedPayload {
  hash: string;
  excludedIndexes: number[];
  options: AddTorrentOptions;
}

export function useTorrentPrefetch() {
  const api = useApi();
  const queryClient = useQueryClient();
  const metadataApiUrl = useSettingsStore((s) => s.metadataApiUrl);

  const readContents = useMutation<TorrentContents, Error, ContentsPayload>({
    mutationFn: async (payload) => {
      if (!api) throw new Error('Not connected');

      if (payload.type === 'magnet') {
        if (!metadataApiUrl) {
          throw new Error('Set a metadata API in Settings to list a magnet link’s files');
        }
        logger.info('Fetching magnet metadata from the metadata API', 'prefetch');
        const metadata = await fetchMagnetMetadata(metadataApiUrl, payload.url);
        return {
          source: 'magnet',
          name: metadata.name,
          totalSize: metadata.totalSize,
          files: metadata.files,
        };
      }

      // A .torrent file goes in stopped: qBittorrent then knows its contents
      // right away, and nothing downloads until the user confirms.
      logger.info(`Reading contents of ${payload.fileName}`, 'prefetch');
      const known = new Set((await api.getTorrents()).map((torrent) => torrent.hash));
      await api.addTorrentFile(payload.fileUri, payload.fileName, { paused: true });

      const hash = await api.waitForTorrentHash(known, null);
      if (!hash) throw new Error('qBittorrent did not accept the torrent file');

      let files: TorrentFile[] = [];
      try {
        files = await api.waitForTorrentFiles(hash, STOPPED_METADATA_TIMEOUT_MS);
      } catch (error) {
        await api.deleteTorrents([hash], true).catch(() => {});
        throw error;
      }
      if (files.length === 0) {
        await api.deleteTorrents([hash], true).catch(() => {});
        throw new Error('qBittorrent did not report the torrent’s files');
      }

      const info = (await api.getTorrents()).find((torrent) => torrent.hash === hash);
      return {
        source: 'file',
        name: info?.name ?? payload.fileName,
        totalSize: files.reduce((total, file) => total + file.size, 0),
        files,
        stagedHash: hash,
      };
    },
    onError: (error) => logger.error(`Metadata lookup failed: ${error.message}`, 'prefetch'),
  });

  /** Applies the file selection to an already staged .torrent, then starts it. */
  const confirmStaged = useMutation<void, Error, ConfirmStagedPayload>({
    mutationFn: async ({ hash, excludedIndexes, options }) => {
      if (!api) throw new Error('Not connected');
      if (excludedIndexes.length > 0) {
        await api.setFilePriority(hash, excludedIndexes, PRIORITY_SKIP);
      }
      if (!options.paused) await api.resumeTorrents([hash]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['torrents'] });
    },
  });

  /**
   * Adds a magnet link and skips the files the user deselected.
   *
   * Priorities can only be set once qBittorrent has the metadata, which a
   * magnet only gets from peers — so the torrent goes in stopped and is
   * started if the metadata does not turn up that way.  qBittorrent fetches
   * metadata before any file data, so deselected files are marked before they
   * would be written.
   */
  const confirmMagnet = useMutation<string | null, Error, ConfirmMagnetPayload>({
    mutationFn: async ({ url, excludedPaths, options }) => {
      if (!api) throw new Error('Not connected');

      if (excludedPaths.length === 0) {
        await api.addMagnet([url], options);
        return null;
      }

      const known = new Set((await api.getTorrents()).map((torrent) => torrent.hash));
      await api.addMagnet([url], { ...options, paused: true });

      const hash = await api.waitForTorrentHash(known, magnetInfoHash(url));
      if (!hash) return 'Magnet added, but the file selection could not be applied';

      let files = await api.waitForTorrentFiles(hash, STOPPED_METADATA_TIMEOUT_MS);
      if (files.length === 0) {
        await api.resumeTorrents([hash]);
        files = await api.waitForTorrentFiles(hash, RUNNING_METADATA_TIMEOUT_MS);
      }

      let warning: string | null = null;
      if (files.length === 0) {
        warning = 'Magnet added, but its metadata never arrived — no files were skipped';
      } else {
        const excluded = new Set(excludedPaths);
        const ids = files.filter((file) => excluded.has(file.name)).map((file) => file.index);
        if (ids.length === 0) warning = 'Magnet added, but the deselected files could not be matched';
        else await api.setFilePriority(hash, ids, PRIORITY_SKIP);
      }

      if (options.paused) await api.pauseTorrents([hash]);
      else await api.resumeTorrents([hash]);
      return warning;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['torrents'] });
    },
  });

  /** Removes a .torrent that was staged for its contents but never confirmed. */
  async function discard(hash: string): Promise<void> {
    if (!api) return;
    try {
      await api.deleteTorrents([hash], true);
      queryClient.invalidateQueries({ queryKey: ['torrents'] });
    } catch (error) {
      logger.warn(
        `Failed to discard staged torrent: ${error instanceof Error ? error.message : String(error)}`,
        'prefetch'
      );
    }
  }

  return { readContents, confirmStaged, confirmMagnet, discard, metadataApiUrl };
}
