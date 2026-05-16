import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  Torrent,
  TorrentAction,
  AddTorrentOptions,
  QBitAPI,
  filterTorrents,
} from "@qbitui/core";
import { useSessionStore } from "../hooks/useSession";
import { useUIStore } from "../store";

function useAPI(): QBitAPI | null {
  const session = useSessionStore((s) => s.session);
  if (!session) return null;
  return new QBitAPI(session.host, session.sid);
}

export function useTorrents() {
  const api = useAPI();
  const { filter, search, sortField, sortDirection } = useUIStore();

  const query = useQuery<Torrent[]>({
    queryKey: ["torrents"],
    queryFn: () => {
      if (!api) throw new Error("Not authenticated");
      return api.getTorrents();
    },
    enabled: !!api,
    refetchInterval: 2000,
    staleTime: 1000,
  });

  const filtered = useMemo(() => {
    let data = query.data ?? [];
    data = filterTorrents(data, filter);

    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.category?.toLowerCase().includes(q) ||
          t.tags?.toLowerCase().includes(q)
      );
    }

    data = [...data].sort((a, b) => {
      const aVal = a[sortField as keyof Torrent];
      const bVal = b[sortField as keyof Torrent];
      const dir = sortDirection === "asc" ? 1 : -1;
      if (typeof aVal === "string" && typeof bVal === "string") {
        return aVal.localeCompare(bVal) * dir;
      }
      if (typeof aVal === "number" && typeof bVal === "number") {
        return (aVal - bVal) * dir;
      }
      return 0;
    });

    return data;
  }, [query.data, filter, search, sortField, sortDirection]);

  return { ...query, filteredTorrents: filtered };
}

export function useTorrentAction() {
  const api = useAPI();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      action,
      hashes,
      deleteFiles,
    }: {
      action: TorrentAction;
      hashes: string[];
      deleteFiles?: boolean;
    }) => {
      if (!api) throw new Error("Not authenticated");
      switch (action) {
        case "pause":
          return api.pauseTorrents(hashes);
        case "resume":
          return api.resumeTorrents(hashes);
        case "delete":
          return api.deleteTorrents(hashes, deleteFiles ?? false);
        case "recheck":
          return api.recheckTorrents(hashes);
        case "reannounce":
          return api.reannounceTorrents(hashes);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["torrents"] });
    },
  });
}

export function useAddTorrent() {
  const api = useAPI();
  const queryClient = useQueryClient();

  const addMagnet = useMutation({
    mutationFn: async ({ urls, options }: { urls: string[]; options: AddTorrentOptions }) => {
      if (!api) throw new Error("Not authenticated");
      return api.addMagnet(urls, options);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["torrents"] });
    },
  });

  const addFile = useMutation({
    mutationFn: async ({
      uri,
      name,
      options,
    }: {
      uri: string;
      name: string;
      options: AddTorrentOptions;
    }) => {
      if (!api) throw new Error("Not authenticated");
      return api.addTorrentFileFromUri(uri, name, options);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["torrents"] });
    },
  });

  return { addMagnet, addFile };
}
