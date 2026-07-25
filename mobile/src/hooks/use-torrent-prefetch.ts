import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useApi } from '@/hooks/use-qbit';
import { logger } from '@/lib/logger';
import { AddTorrentOptions, TorrentFile } from '@/lib/types';
import { magnetInfoHash } from '@/lib/utils';

/** Priority 0 means "do not download this file". */
const PRIORITY_SKIP = 0;

/** Give up on magnet metadata after this long; peers may simply not answer. */
const METADATA_TIMEOUT_MS = 60_000;

/**
 * A torrent whose contents are known but which is not downloading yet.  The
 * phone has no way to read a magnet's file list on its own, so the torrent is
 * "staged": added to qBittorrent in a stopped state purely to fetch its
 * metadata, then either confirmed or deleted again.
 */
export interface StagedTorrent {
  hash: string;
  name: string;
  totalSize: number;
  files: TorrentFile[];
}

export type StagePayload =
  | { type: 'magnet'; url: string }
  | { type: 'file'; fileUri: string; fileName: string };

export interface ConfirmPayload {
  hash: string;
  /** Indexes the user deselected; they are set to "do not download". */
  excludedIndexes: number[];
  options: AddTorrentOptions;
}

export function useTorrentPrefetch() {
  const api = useApi();
  const queryClient = useQueryClient();

  const stage = useMutation<StagedTorrent, Error, StagePayload>({
    mutationFn: async (payload) => {
      if (!api) throw new Error('Not connected');

      const known = new Set((await api.getTorrents()).map((torrent) => torrent.hash));
      const hint = payload.type === 'magnet' ? magnetInfoHash(payload.url) : null;
      if (hint && known.has(hint)) {
        throw new Error('This torrent is already in qBittorrent');
      }

      logger.info(
        `Fetching metadata for ${payload.type === 'magnet' ? payload.url : payload.fileName}`,
        'prefetch'
      );

      if (payload.type === 'magnet') {
        await api.addMagnet([payload.url], { paused: true });
      } else {
        await api.addTorrentFile(payload.fileUri, payload.fileName, { paused: true });
      }

      const hash = await api.waitForTorrentHash(known, hint);
      if (!hash) throw new Error('qBittorrent did not accept the torrent');

      let files: TorrentFile[] = [];
      try {
        files = await api.waitForTorrentFiles(hash, METADATA_TIMEOUT_MS);
      } catch (error) {
        await api.deleteTorrents([hash], true).catch(() => {});
        throw error;
      }
      if (files.length === 0) {
        await api.deleteTorrents([hash], true).catch(() => {});
        throw new Error('Timed out waiting for metadata from peers');
      }

      const info = (await api.getTorrents()).find((torrent) => torrent.hash === hash);
      return {
        hash,
        name: info?.name ?? files[0].name.split('/')[0],
        totalSize: files.reduce((total, file) => total + file.size, 0),
        files,
      };
    },
    onError: (error) => logger.error(`Metadata prefetch failed: ${error.message}`, 'prefetch'),
  });

  /** Applies the file selection and options, then starts the staged torrent. */
  const confirm = useMutation<void, Error, ConfirmPayload>({
    mutationFn: async ({ hash, excludedIndexes, options }) => {
      if (!api) throw new Error('Not connected');
      if (excludedIndexes.length > 0) {
        await api.setFilePriority(hash, excludedIndexes, PRIORITY_SKIP);
      }
      if (options.savepath) await api.setLocation([hash], options.savepath);
      if (options.category) await api.setCategory([hash], options.category);
      if (options.tags) await api.addTags([hash], options.tags);
      if (!options.paused) await api.resumeTorrents([hash]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['torrents'] });
    },
  });

  /** Removes a torrent that was staged for its metadata but never confirmed. */
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

  return { stage, confirm, discard };
}
