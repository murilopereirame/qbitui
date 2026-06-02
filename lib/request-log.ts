export interface RequestLogEntry {
  id: number;
  timestamp: string;
  method: string;
  path: string;
  status: number | null;
  duration: number;
  error?: string;
  body?: string;
}

const MAX_ENTRIES = 500;
let nextId = 1;
const entries: RequestLogEntry[] = [];

export function addRequestLog(entry: Omit<RequestLogEntry, "id">): void {
  entries.push({ id: nextId++, ...entry });
  if (entries.length > MAX_ENTRIES) entries.shift();
}

export function getRequestLogs(): RequestLogEntry[] {
  return [...entries].reverse();
}

export function clearRequestLogs(): void {
  entries.length = 0;
}
