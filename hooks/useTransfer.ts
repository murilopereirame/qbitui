"use client";

import { useQuery } from "@tanstack/react-query";
import { TransferInfo } from "@/lib/types";

async function fetchTransfer(): Promise<TransferInfo> {
  const res = await fetch("/api/transfer");
  if (!res.ok) throw new Error("Failed to fetch transfer info");
  return res.json();
}

export function useTransfer() {
  return useQuery<TransferInfo>({
    queryKey: ["transfer"],
    queryFn: fetchTransfer,
    refetchInterval: 2000,
    refetchIntervalInBackground: true,
    staleTime: 1000,
  });
}
