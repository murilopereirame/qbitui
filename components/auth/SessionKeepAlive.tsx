"use client";

import { useKeepAlive } from "@/hooks/useKeepAlive";

export function SessionKeepAlive() {
  useKeepAlive();
  return null;
}
