import { create } from "zustand";
import { TorrentFilter, SortField, SortDirection } from "@/lib/types";

interface UIState {
  filter: TorrentFilter;
  search: string;
  sortField: SortField;
  sortDirection: SortDirection;
  selectedHashes: Set<string>;
  activeTorrentHash?: string;
  isAddModalOpen: boolean;
  pendingMagnet: string | null;

  setFilter: (filter: TorrentFilter) => void;
  setSearch: (search: string) => void;
  setSortField: (field: SortField) => void;
  setSortDirection: (dir: SortDirection) => void;
  toggleSort: (field: SortField) => void;
  toggleSelection: (hash: string) => void;
  selectAll: (hashes: string[]) => void;
  clearSelection: () => void;
  setActiveTorrentHash: (hash?: string) => void;
  setAddModalOpen: (open: boolean) => void;
  setPendingMagnet: (url: string | null) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  filter: "all",
  search: "",
  sortField: "added_on",
  sortDirection: "desc",
  selectedHashes: new Set(),
  activeTorrentHash: undefined,
  isAddModalOpen: false,
  pendingMagnet: null,

  setFilter: (filter) => set({ filter, selectedHashes: new Set() }),
  setSearch: (search) => set({ search }),
  setSortField: (sortField) => set({ sortField }),
  setSortDirection: (sortDirection) => set({ sortDirection }),
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
  setActiveTorrentHash: (activeTorrentHash) => set({ activeTorrentHash }),
  setAddModalOpen: (open) => set({ isAddModalOpen: open }),
  setPendingMagnet: (url) => set({ pendingMagnet: url }),
}));
