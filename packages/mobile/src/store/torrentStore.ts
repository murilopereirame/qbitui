import { create } from 'zustand';
import type { TorrentFilter, SortField, SortDirection } from '@qbitui/core';

interface TorrentUIState {
  filter: TorrentFilter;
  search: string;
  sortField: SortField;
  sortDirection: SortDirection;
  setFilter: (filter: TorrentFilter) => void;
  setSearch: (search: string) => void;
  toggleSort: (field: SortField) => void;
}

export const useTorrentStore = create<TorrentUIState>((set, get) => ({
  filter: 'all',
  search: '',
  sortField: 'added_on',
  sortDirection: 'desc',
  setFilter: (filter) => set({ filter }),
  setSearch: (search) => set({ search }),
  toggleSort: (field) => {
    const { sortField, sortDirection } = get();
    if (sortField === field) {
      set({ sortDirection: sortDirection === 'asc' ? 'desc' : 'asc' });
    } else {
      set({ sortField: field, sortDirection: 'asc' });
    }
  },
}));
