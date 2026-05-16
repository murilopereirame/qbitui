import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { QBitAPI } from '@/lib/qbit-api';
import { Torrent, TorrentAction, AddTorrentOptions } from '@/lib/types';
import { FILTER_STATES } from '@/lib/utils';
import { useAuthStore, useUIStore } from '@/store';

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

  return useMutation({
    mutationFn: async ({ action, hashes, deleteFiles }: { action: TorrentAction; hashes: string[]; deleteFiles?: boolean }) => {
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['torrents'] });
    },
  });
}

export function useAddTorrent() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ urls, options }: { urls: string[]; options: AddTorrentOptions }) => {
      if (!api) throw new Error('Not connected');
      return api.addMagnet(urls, options);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['torrents'] });
    },
  });
}
