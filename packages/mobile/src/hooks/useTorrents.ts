import { useQuery } from '@tanstack/react-query';
import { QBitAPI } from '@qbitui/core';
import { useAuthStore } from '../store/authStore';

export function useTorrents(filter?: string) {
  const { host, sid } = useAuthStore();
  return useQuery({
    queryKey: ['torrents', filter],
    queryFn: () => new QBitAPI(host, sid).getTorrents(filter),
    enabled: !!sid,
    refetchInterval: 5000,
  });
}

export function useTransferInfo() {
  const { host, sid } = useAuthStore();
  return useQuery({
    queryKey: ['transferInfo'],
    queryFn: () => new QBitAPI(host, sid).getTransferInfo(),
    enabled: !!sid,
    refetchInterval: 5000,
  });
}
