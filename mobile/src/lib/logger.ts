export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  ts: number;
  level: LogLevel;
  msg: string;
  ctx?: string;
}

const MAX_ENTRIES = 500;
const _entries: LogEntry[] = [];
const _listeners: Array<() => void> = [];

function notify() {
  for (const fn of _listeners) fn();
}

function push(level: LogLevel, msg: string, ctx?: string) {
  _entries.push({ ts: Date.now(), level, msg, ctx });
  if (_entries.length > MAX_ENTRIES) {
    _entries.splice(0, _entries.length - MAX_ENTRIES);
  }
  notify();
}

export const logger = {
  info: (msg: string, ctx?: string) => push('info', msg, ctx),
  warn: (msg: string, ctx?: string) => push('warn', msg, ctx),
  error: (msg: string, ctx?: string) => push('error', msg, ctx),
  getLogs: (): readonly LogEntry[] => _entries,
  clear: () => { _entries.splice(0); notify(); },
  subscribe: (fn: () => void): (() => void) => {
    _listeners.push(fn);
    return () => {
      const i = _listeners.indexOf(fn);
      if (i >= 0) _listeners.splice(i, 1);
    };
  },
};
