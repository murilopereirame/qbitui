import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApi } from '@/hooks/use-qbit';
import { logger } from '@/lib/logger';
import { Category } from '@/lib/types';

/** Categories and tags change rarely, so they poll far slower than the torrent list. */
const REFETCH_INTERVAL = 15_000;

export function useCategories() {
  const api = useApi();
  return useQuery<Record<string, Category>>({
    queryKey: ['categories'],
    queryFn: () => api!.getCategories(),
    enabled: !!api,
    refetchInterval: REFETCH_INTERVAL,
    staleTime: 10_000,
  });
}

export function useTags() {
  const api = useApi();
  return useQuery<string[]>({
    queryKey: ['tags'],
    queryFn: () => api!.getTags(),
    enabled: !!api,
    refetchInterval: REFETCH_INTERVAL,
    staleTime: 10_000,
  });
}

export function useCategoryMutations() {
  const api = useApi();
  const queryClient = useQueryClient();
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['categories'] });
    queryClient.invalidateQueries({ queryKey: ['torrents'] });
  };

  const createCategory = useMutation({
    mutationFn: async ({ name, savePath }: { name: string; savePath?: string }) => {
      if (!api) throw new Error('Not connected');
      logger.info(`Creating category: ${name}`, 'use-taxonomy');
      return api.createCategory(name, savePath ?? '');
    },
    onSuccess: refresh,
  });

  const editCategory = useMutation({
    mutationFn: async ({ name, savePath }: { name: string; savePath?: string }) => {
      if (!api) throw new Error('Not connected');
      return api.editCategory(name, savePath ?? '');
    },
    onSuccess: refresh,
  });

  const removeCategories = useMutation({
    mutationFn: async (names: string[]) => {
      if (!api) throw new Error('Not connected');
      logger.info(`Removing categories: ${names.join(', ')}`, 'use-taxonomy');
      return api.removeCategories(names);
    },
    onSuccess: refresh,
  });

  return { createCategory, editCategory, removeCategories };
}

export function useTagMutations() {
  const api = useApi();
  const queryClient = useQueryClient();
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['tags'] });
    queryClient.invalidateQueries({ queryKey: ['torrents'] });
  };

  const createTags = useMutation({
    mutationFn: async (tags: string[]) => {
      if (!api) throw new Error('Not connected');
      logger.info(`Creating tags: ${tags.join(', ')}`, 'use-taxonomy');
      return api.createTags(tags);
    },
    onSuccess: refresh,
  });

  const deleteTags = useMutation({
    mutationFn: async (tags: string[]) => {
      if (!api) throw new Error('Not connected');
      logger.info(`Deleting tags: ${tags.join(', ')}`, 'use-taxonomy');
      return api.deleteTags(tags);
    },
    onSuccess: refresh,
  });

  return { createTags, deleteTags };
}

/**
 * Assigns categories and tags to torrents.  Tagging a torrent with a name that
 * does not exist yet creates the tag, so the tag list is refreshed too.
 */
export function useTorrentTaxonomy() {
  const api = useApi();
  const queryClient = useQueryClient();
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['torrents'] });
    queryClient.refetchQueries({ queryKey: ['torrents'], type: 'active' });
    queryClient.invalidateQueries({ queryKey: ['tags'] });
    queryClient.invalidateQueries({ queryKey: ['categories'] });
  };

  const setCategory = useMutation({
    mutationFn: async ({ hashes, category }: { hashes: string[]; category: string }) => {
      if (!api) throw new Error('Not connected');
      return api.setCategory(hashes, category);
    },
    onSuccess: refresh,
  });

  const addTags = useMutation({
    mutationFn: async ({ hashes, tags }: { hashes: string[]; tags: string[] }) => {
      if (!api) throw new Error('Not connected');
      return api.addTags(hashes, tags.join(','));
    },
    onSuccess: refresh,
  });

  const removeTags = useMutation({
    mutationFn: async ({ hashes, tags }: { hashes: string[]; tags: string[] }) => {
      if (!api) throw new Error('Not connected');
      return api.removeTags(hashes, tags.join(','));
    },
    onSuccess: refresh,
  });

  return { setCategory, addTags, removeTags };
}
