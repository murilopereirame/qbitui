"use client";

import { useQuery } from "@tanstack/react-query";

const KEEPALIVE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

async function pingSession(): Promise<void> {
  const res = await fetch("/api/auth/keepalive");
  if (!res.ok) {
    throw new Error(`Session keepalive failed: ${res.status}`);
  }
}

export function useKeepAlive() {
  return useQuery({
    queryKey: ["session-keepalive"],
    queryFn: pingSession,
    refetchInterval: KEEPALIVE_INTERVAL_MS,
    refetchIntervalInBackground: true,
    retry: 1,
    staleTime: Infinity,
  });
}
