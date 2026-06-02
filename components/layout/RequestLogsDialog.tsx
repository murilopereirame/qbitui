"use client";

import { useEffect, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RequestLogEntry } from "@/lib/request-log";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

function statusColor(status: number | null): string {
  if (status === null) return "text-red-400";
  if (status < 300) return "text-green-400";
  if (status < 400) return "text-yellow-400";
  return "text-red-400";
}

function LogRow({ entry }: { entry: RequestLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const hasBody = !!entry.body;
  return (
    <>
      <tr
        className={cn("border-b border-white/5", hasBody ? "cursor-pointer hover:bg-white/5" : "hover:bg-white/3")}
        onClick={() => hasBody && setExpanded((v) => !v)}>
        <td className="px-2 py-1 text-gray-500 whitespace-nowrap">
          {new Date(entry.timestamp).toLocaleTimeString()}
        </td>
        <td className="px-2 py-1 text-blue-300">{entry.method}</td>
        <td className="px-2 py-1 text-gray-300 truncate max-w-xs" title={entry.path}>
          <span className="flex items-center gap-1">
            {hasBody && (expanded ? <ChevronDown className="h-3 w-3 shrink-0 text-gray-500" /> : <ChevronRight className="h-3 w-3 shrink-0 text-gray-500" />)}
            {entry.path}
            {entry.error && <span className="text-red-400 ml-2">({entry.error})</span>}
          </span>
        </td>
        <td className={cn("px-2 py-1 text-right", statusColor(entry.status))}>
          {entry.status ?? "ERR"}
        </td>
        <td className="px-2 py-1 text-right text-gray-400">{entry.duration}ms</td>
      </tr>
      {expanded && entry.body && (
        <tr className="border-b border-white/5 bg-black/30">
          <td colSpan={5} className="px-4 py-2">
            <pre className="text-xs text-gray-400 whitespace-pre-wrap break-all font-mono">{entry.body}</pre>
          </td>
        </tr>
      )}
    </>
  );
}

export function RequestLogsDialog({ open, onClose }: Props) {
  const [logs, setLogs] = useState<RequestLogEntry[]>([]);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/request-logs");
      if (res.ok) setLogs(await res.json());
    } catch {}
  }, []);

  async function clearLogs() {
    await fetch("/api/request-logs", { method: "DELETE" });
    setLogs([]);
  }

  useEffect(() => {
    if (!open) return;
    fetchLogs();
    const id = setInterval(fetchLogs, 2000);
    return () => clearInterval(id);
  }, [open, fetchLogs]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>API Request Logs</DialogTitle>
            <Button size="sm" variant="ghost" onClick={clearLogs} className="gap-1.5 text-gray-400 hover:text-red-400">
              <Trash2 className="h-3.5 w-3.5" /> Clear
            </Button>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-auto min-h-0">
          {logs.length === 0 ? (
            <p className="text-sm text-gray-500 p-4">No requests logged yet.</p>
          ) : (
            <table className="w-full text-xs font-mono">
              <thead className="sticky top-0 bg-gray-950 text-gray-400 border-b border-white/10">
                <tr>
                  <th className="text-left px-2 py-1.5 w-44">Time</th>
                  <th className="text-left px-2 py-1.5 w-12">Method</th>
                  <th className="text-left px-2 py-1.5">Path</th>
                  <th className="text-right px-2 py-1.5 w-16">Status</th>
                  <th className="text-right px-2 py-1.5 w-20">Duration</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((entry) => (
                  <LogRow key={entry.id} entry={entry} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
