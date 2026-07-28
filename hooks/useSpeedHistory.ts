"use client";

import { useEffect, useRef, useState } from "react";

export interface SpeedSample {
  dl: number;
  up: number;
}

/** How often a sample is taken, and how many are kept (2s × 60 = 2 minutes). */
export const SPEED_SAMPLE_MS = 2000;
export const SPEED_HISTORY_SIZE = 60;

interface HistoryState {
  /** The torrent the samples belong to; a change starts a fresh series. */
  hash?: string;
  samples: SpeedSample[];
}

/**
 * Keeps a rolling history of a torrent's transfer speeds.
 *
 * Sampling on a timer rather than on every poll keeps the spacing even, so the
 * graph stays readable even when a refetch is slow or skipped.  Selecting a
 * different torrent starts the series over.
 */
export function useSpeedHistory(
  hash: string | undefined,
  dl: number,
  up: number,
  sampleMs: number = SPEED_SAMPLE_MS,
  capacity: number = SPEED_HISTORY_SIZE
): SpeedSample[] {
  const latest = useRef({ hash, dl, up });
  const [state, setState] = useState<HistoryState>({ hash, samples: [] });

  useEffect(() => {
    latest.current = { hash, dl, up };
  }, [hash, dl, up]);

  useEffect(() => {
    const id = setInterval(() => {
      const current = latest.current;
      setState((previous) =>
        previous.hash === current.hash
          ? {
              hash: current.hash,
              samples: [...previous.samples, { dl: current.dl, up: current.up }].slice(-capacity),
            }
          : { hash: current.hash, samples: [{ dl: current.dl, up: current.up }] }
      );
    }, sampleMs);
    return () => clearInterval(id);
  }, [sampleMs, capacity]);

  return state.hash === hash ? state.samples : [];
}
