import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { QBitAPI, SessionExpiredError } from '@/lib/qbit-api';
import { Torrent, TorrentAction, AddTorrentOptions } from '@/lib/types';
import { FILTER_STATES } from '@/lib/utils';
import { useAuthStore, useUIStore, StoredCredentials, refreshSession } from '@/store';

type AddTorrentPayload =
  | { type: 'magnet'; urls: string[]; options: AddTorrentOptions }
  | { type: 'file'; fileUri: string; fileName: string; options: AddTorrentOptions };
type TorrentActionPayload = { action: TorrentAction; hashes: string[]; deleteFiles?: boolean };
type FilePriorityPayload = { hash: string; fileIds: number[]; priority: number };

function useCreds() {
  return useAuthStore((s) => s.credentials);
}

async function withRefresh<T>(
  creds: StoredCredentials,
  fn: (api: QBitAPI) => Promise<T>
): Promise<T> {
  try {
    return await fn(new QBitAPI(creds.host, creds.sid));
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      const newSid = await refreshSession();
      if (newSid) return fn(new QBitAPI(creds.host, newSid));
    }
    throw error;
  }
}

export function useTorrents() {
  const creds = useCreds();
  const { filter, search } = useUIStore();

  const query = useQuery<Torrent[]>({
    queryKey: ['torrents'],
    queryFn: () => withRefresh(creds!, (api) => api.getTorrents()),
    enabled: !!creds,
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
  const creds = useCreds();
  return useQuery({
    queryKey: ['transfer'],
    queryFn: () => withRefresh(creds!, (api) => api.getTransferInfo()),
    enabled: !!creds,
    refetchInterval: 2000,
    staleTime: 1000,
  });
}

export function useTorrentDetails(hash: string | undefined) {
  const creds = useCreds();

  const properties = useQuery({
    queryKey: ['torrent-properties', hash],
    queryFn: () => withRefresh(creds!, (api) => api.getTorrentProperties(hash!)),
    enabled: !!creds && !!hash,
    refetchInterval: 5000,
    staleTime: 4000,
  });

  const trackers = useQuery({
    queryKey: ['torrent-trackers', hash],
    queryFn: () => withRefresh(creds!, (api) => api.getTorrentTrackers(hash!)),
    enabled: !!creds && !!hash,
    refetchInterval: 10000,
    staleTime: 9000,
  });

  const files = useQuery({
    queryKey: ['torrent-files', hash],
    queryFn: () => withRefresh(creds!, (api) => api.getTorrentFiles(hash!)),
    enabled: !!creds && !!hash,
    refetchInterval: 10000,
    staleTime: 9000,
  });

  return { properties, trackers, files };
}

export function useTorrentAction() {
  const creds = useCreds();
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
      if (state === 'stoppedUP' || state === 'pausedUP') return 'queuedUP';
      if (state === 'stoppedDL' || state === 'pausedDL') return 'queuedDL';
      return progress >= 1 ? 'queuedUP' : 'queuedDL';
    }
    return state;
  };

  return useMutation({
    mutationFn: async ({ action, hashes, deleteFiles }: TorrentActionPayload) => {
      if (!creds) throw new Error('Not connected');
      return withRefresh(creds, (api) => {
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
      });
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
            return {
              ...torrent,
              state: nextState,
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
  const creds = useCreds();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: AddTorrentPayload) => {
      if (!creds) throw new Error('Not connected');
      return withRefresh(creds, (api) => {
        if (payload.type === 'magnet') return api.addMagnet(payload.urls, payload.options);
        return api.addTorrentFile(payload.fileUri, payload.fileName, payload.options);
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['torrents'] });
    },
  });
}

export function useSetTorrentFilePriority() {
  const creds = useCreds();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ hash, fileIds, priority }: FilePriorityPayload) => {
      if (!creds) throw new Error('Not connected');
      return withRefresh(creds, (api) => api.setFilePriority(hash, fileIds, priority));
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['torrent-files', variables.hash] });
      queryClient.refetchQueries({ queryKey: ['torrent-files', variables.hash], type: 'active' });
      queryClient.invalidateQueries({ queryKey: ['torrents'] });
      queryClient.refetchQueries({ queryKey: ['torrents'], type: 'active' });
    },
  });
}
