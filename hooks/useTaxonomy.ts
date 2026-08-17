"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Category } from "@/lib/types";

/** Categories and tags change rarely, so they poll far slower than the torrent list. */
const REFETCH_INTERVAL = 15_000;

async function request<T>(url: string, init?: RequestInit, fallbackError = "Request failed"): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...init?.headers } : init?.headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? fallbackError);
  return data as T;
}

export function useCategories() {
  return useQuery<Record<string, Category>>({
    queryKey: ["categories"],
    queryFn: () => request<Record<string, Category>>("/api/categories", undefined, "Failed to fetch categories"),
    refetchInterval: REFETCH_INTERVAL,
    staleTime: 10_000,
  });
}

export function useTags() {
  return useQuery<string[]>({
    queryKey: ["tags"],
    queryFn: () => request<string[]>("/api/tags", undefined, "Failed to fetch tags"),
    refetchInterval: REFETCH_INTERVAL,
    staleTime: 10_000,
  });
}

export function useCategoryMutations() {
  const queryClient = useQueryClient();
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["categories"] });
    queryClient.invalidateQueries({ queryKey: ["torrents"] });
  };

  const createCategory = useMutation({
    mutationFn: ({ name, savePath }: { name: string; savePath?: string }) =>
      request("/api/categories", { method: "POST", body: JSON.stringify({ name, savePath }) }, "Failed to create category"),
    onSuccess: refresh,
  });

  const editCategory = useMutation({
    mutationFn: ({ name, savePath }: { name: string; savePath?: string }) =>
      request("/api/categories", { method: "PATCH", body: JSON.stringify({ name, savePath }) }, "Failed to edit category"),
    onSuccess: refresh,
  });

  const removeCategories = useMutation({
    mutationFn: (names: string[]) =>
      request("/api/categories", { method: "DELETE", body: JSON.stringify({ names }) }, "Failed to remove category"),
    onSuccess: refresh,
  });

  return { createCategory, editCategory, removeCategories };
}

export function useTagMutations() {
  const queryClient = useQueryClient();
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["tags"] });
    queryClient.invalidateQueries({ queryKey: ["torrents"] });
  };

  const createTags = useMutation({
    mutationFn: (tags: string[]) =>
      request("/api/tags", { method: "POST", body: JSON.stringify({ tags }) }, "Failed to create tag"),
    onSuccess: refresh,
  });

  const deleteTags = useMutation({
    mutationFn: (tags: string[]) =>
      request("/api/tags", { method: "DELETE", body: JSON.stringify({ tags }) }, "Failed to delete tag"),
    onSuccess: refresh,
  });

  return { createTags, deleteTags };
}

/**
 * Assigns categories and tags to torrents.  Tagging a torrent with a name that
 * does not exist yet creates the tag, so the tag list is refreshed too.
 */
export function useTorrentTaxonomy() {
  const queryClient = useQueryClient();
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["torrents"] });
    queryClient.invalidateQueries({ queryKey: ["tags"] });
    queryClient.invalidateQueries({ queryKey: ["categories"] });
  };

  const setCategory = useMutation({
    mutationFn: ({ hashes, category }: { hashes: string[]; category: string }) =>
      request(
        "/api/torrents/action",
        { method: "POST", body: JSON.stringify({ action: "setCategory", hashes, category }) },
        "Failed to set category"
      ),
    onSuccess: refresh,
  });

  const addTags = useMutation({
    mutationFn: ({ hashes, tags }: { hashes: string[]; tags: string[] }) =>
      request(
        "/api/torrents/action",
        { method: "POST", body: JSON.stringify({ action: "addTags", hashes, tags }) },
        "Failed to add tags"
      ),
    onSuccess: refresh,
  });

  const removeTags = useMutation({
    mutationFn: ({ hashes, tags }: { hashes: string[]; tags: string[] }) =>
      request(
        "/api/torrents/action",
        { method: "POST", body: JSON.stringify({ action: "removeTags", hashes, tags }) },
        "Failed to remove tags"
      ),
    onSuccess: refresh,
  });

  return { setCategory, addTags, removeTags };
}
