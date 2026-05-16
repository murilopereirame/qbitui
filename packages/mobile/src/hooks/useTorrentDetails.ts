import { useQuery } from '@tanstack/react-query';
import { QBitAPI } from '@qbitui/core';
import { useAuthStore } from '../store/authStore';

export function useTorrentDetails(hash: string) {
  const { host, sid } = useAuthStore();
  const api = new QBitAPI(host, sid);
  return useQuery({
    queryKey: ['torrentDetails', hash],
    queryFn: async () => {
      const [properties, trackers, peers, files] = await Promise.all([
        api.getTorrentProperties(hash),
        api.getTorrentTrackers(hash),
        api.getTorrentPeers(hash),
        api.getTorrentFiles(hash),
      ]);
      return { properties, trackers, peers, files };
    },
    enabled: !!sid && !!hash,
    refetchInterval: 5000,
  });
}
