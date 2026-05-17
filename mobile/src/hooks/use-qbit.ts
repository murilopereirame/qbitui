import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { QBitAPI } from '@/lib/qbit-api';
import { Torrent, TorrentAction, AddTorrentOptions } from '@/lib/types';
import { FILTER_STATES } from '@/lib/utils';
import { useAuthStore, useUIStore } from '@/store';

type AddTorrentPayload =
  | { type: 'magnet'; urls: string[]; options: AddTorrentOptions }
  | { type: 'file'; fileUri: string; fileName: string; options: AddTorrentOptions };
type TorrentActionPayload = { action: TorrentAction; hashes: string[]; deleteFiles?: boolean };
type FilePriorityPayload = { hash: string; fileIds: number[]; priority: number };

function useApi(): QBitAPI | null {
  const creds = useAuthStore((s) => s.credentials);
  if (!creds) return null;
  return new QBitAPI(creds.host, creds.sid);
}

export function useTorrents() {
  const api = useApi();
  const { filter, search } = useUIStore();

  const query = useQuery<Torrent[]>({
    queryKey: ['torrents'],
    queryFn: () => api!.getTorrents(),
    enabled: !!api,
    refetchInterval: 2000,
    staleTime: 1000,
  });

  const filteredTorrents = useMemo(() => {
    let data = query.data ?? [];

    if (filter !== 'all') {
      const states = FILTER_STATES[filter];
      data = data.filter((t) => {
        if (filter === 'completed') {
          return t.progress === 1 || states.includes(t.state);
        }
        return states.includes(t.state);
      });
    }

    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.category?.toLowerCase().includes(q) ||
          t.tags?.toLowerCase().includes(q)
      );
    }

    return data;
  }, [query.data, filter, search]);

  return { ...query, filteredTorrents };
}

export function useTransfer() {
  const api = useApi();
  return useQuery({
    queryKey: ['transfer'],
    queryFn: () => api!.getTransferInfo(),
    enabled: !!api,
    refetchInterval: 2000,
    staleTime: 1000,
  });
}

export function useTorrentDetails(hash: string | undefined) {
  const api = useApi();

  const properties = useQuery({
    queryKey: ['torrent-properties', hash],
    queryFn: () => api!.getTorrentProperties(hash!),
    enabled: !!api && !!hash,
    refetchInterval: 5000,
    staleTime: 4000,
  });

  const trackers = useQuery({
    queryKey: ['torrent-trackers', hash],
    queryFn: () => api!.getTorrentTrackers(hash!),
    enabled: !!api && !!hash,
    refetchInterval: 10000,
    staleTime: 9000,
  });

  const files = useQuery({
    queryKey: ['torrent-files', hash],
    queryFn: () => api!.getTorrentFiles(hash!),
    enabled: !!api && !!hash,
    refetchInterval: 10000,
    staleTime: 9000,
  });

  return { properties, trackers, files };
}

export function useTorrentAction() {
  const api = useApi();
  const queryClient = useQueryClient();

  const getOptimisticState = (state: Torrent['state'], progress: number, action: TorrentAction) => {
    if (action === 'pause') {
      if (state === 'pausedUP' || state === 'pausedDL' || state === 'stoppedUP' || state === 'stoppedDL') {
        return state;
      }
      const shouldPauseAsUpload =
        progress >= 1 ||
        state === 'uploading' ||
        state === 'stalledUP' ||
        state === 'forcedUP' ||
        state === 'queuedUP';
      return shouldPauseAsUpload ? 'pausedUP' : 'pausedDL';
    }
    if (action === 'resume') {
      if (state === 'stoppedUP') return 'queuedUP';
      if (state === 'stoppedDL') return 'queuedDL';
      if (state === 'pausedUP') return 'uploading';
      if (state === 'pausedDL') return 'downloading';
      return progress >= 1 ? 'uploading' : 'downloading';
    }
    return state;
  };

  return useMutation({
    mutationFn: async ({ action, hashes, deleteFiles }: TorrentActionPayload) => {
      if (!api) throw new Error('Not connected');
      switch (action) {
        case 'pause': return api.pauseTorrents(hashes);
        case 'resume': return api.resumeTorrents(hashes);
        case 'delete': return api.deleteTorrents(hashes, deleteFiles ?? false);
        case 'recheck': return api.recheckTorrents(hashes);
        case 'reannounce': return api.reannounceTorrents(hashes);
        case 'topPrio': return api.moveTorrentsTop(hashes);
        case 'bottomPrio': return api.moveTorrentsBottom(hashes);
        default: throw new Error(`Unknown action: ${action}`);
      }
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['torrents'] });
      const previousTorrents = queryClient.getQueryData<Torrent[]>(['torrents']);

      if (previousTorrents && (variables.action === 'pause' || variables.action === 'resume')) {
        const hashes = new Set(variables.hashes);
        queryClient.setQueryData<Torrent[]>(['torrents'], (current) =>
          (current ?? []).map((torrent) => {
            if (!hashes.has(torrent.hash)) return torrent;
            const nextState = getOptimisticState(torrent.state, torrent.progress, variables.action);
            const isPaused = variables.action === 'pause';
            return {
              ...torrent,
              state: nextState,
              dlspeed: isPaused ? 0 : torrent.dlspeed,
              upspeed: isPaused ? 0 : torrent.upspeed,
            };
          })
        );
      }

      return { previousTorrents };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousTorrents) {
        queryClient.setQueryData(['torrents'], context.previousTorrents);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['torrents'] });
      queryClient.refetchQueries({ queryKey: ['torrents'], type: 'active' });
    },
  });
}

export function useAddTorrent() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: AddTorrentPayload) => {
      if (!api) throw new Error('Not connected');
      if (payload.type === 'magnet') {
        return api.addMagnet(payload.urls, payload.options);
      }
      return api.addTorrentFile(payload.fileUri, payload.fileName, payload.options);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['torrents'] });
    },
  });
}

export function useSetTorrentFilePriority() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ hash, fileIds, priority }: FilePriorityPayload) => {
      if (!api) throw new Error('Not connected');
      return api.setFilePriority(hash, fileIds, priority);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['torrent-files', variables.hash] });
      queryClient.refetchQueries({ queryKey: ['torrent-files', variables.hash], type: 'active' });
      queryClient.invalidateQueries({ queryKey: ['torrents'] });
      queryClient.refetchQueries({ queryKey: ['torrents'], type: 'active' });
    },
  });
}
