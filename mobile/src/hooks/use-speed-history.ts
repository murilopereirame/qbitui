import { useEffect, useRef, useState } from 'react';

export interface SpeedSample {
  dl: number;
  up: number;
}

/** How often a sample is taken, and how many are kept (2s × 30 = 1 minute). */
export const SPEED_SAMPLE_MS = 2000;
export const SPEED_HISTORY_SIZE = 30;

/**
 * Keeps a rolling history of a torrent's transfer speeds.
 *
 * Sampling on a timer rather than on every poll keeps the spacing even, so the
 * graph stays readable even when a refetch is slow or skipped.
 */
export function useSpeedHistory(
  dl: number,
  up: number,
  sampleMs: number = SPEED_SAMPLE_MS,
  capacity: number = SPEED_HISTORY_SIZE
): SpeedSample[] {
  const latest = useRef<SpeedSample>({ dl, up });
  const [history, setHistory] = useState<SpeedSample[]>(() => [{ dl, up }]);

  useEffect(() => {
    latest.current = { dl, up };
  }, [dl, up]);

  useEffect(() => {
    const id = setInterval(() => {
      setHistory((previous) => [...previous, latest.current].slice(-capacity));
    }, sampleMs);
    return () => clearInterval(id);
  }, [sampleMs, capacity]);

  return history;
}
