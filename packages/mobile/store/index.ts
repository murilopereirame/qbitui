import { create } from "zustand";
import { TorrentFilter, SortField, SortDirection } from "@qbitui/core";

interface UIState {
  filter: TorrentFilter;
  search: string;
  sortField: SortField;
  sortDirection: SortDirection;
  selectedHashes: Set<string>;
  isAddModalOpen: boolean;
  isFilterSheetOpen: boolean;

  setFilter: (filter: TorrentFilter) => void;
  setSearch: (search: string) => void;
  toggleSort: (field: SortField) => void;
  toggleSelection: (hash: string) => void;
  selectAll: (hashes: string[]) => void;
  clearSelection: () => void;
  setAddModalOpen: (open: boolean) => void;
  setFilterSheetOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  filter: "all",
  search: "",
  sortField: "added_on",
  sortDirection: "desc",
  selectedHashes: new Set(),
  isAddModalOpen: false,
  isFilterSheetOpen: false,

  setFilter: (filter) => set({ filter, selectedHashes: new Set() }),
  setSearch: (search) => set({ search }),
  toggleSort: (field) => {
    const { sortField, sortDirection } = get();
    if (sortField === field) {
      set({ sortDirection: sortDirection === "asc" ? "desc" : "asc" });
    } else {
      set({ sortField: field, sortDirection: "asc" });
    }
  },
  toggleSelection: (hash) => {
    const selected = new Set(get().selectedHashes);
    if (selected.has(hash)) {
      selected.delete(hash);
    } else {
      selected.add(hash);
    }
    set({ selectedHashes: selected });
  },
  selectAll: (hashes) => set({ selectedHashes: new Set(hashes) }),
  clearSelection: () => set({ selectedHashes: new Set() }),
  setAddModalOpen: (open) => set({ isAddModalOpen: open }),
  setFilterSheetOpen: (open) => set({ isFilterSheetOpen: open }),
}));
