"use client";

import { useEffect, useRef, useState } from "react";

export default function LogsPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isScrolledToBottom = useRef(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchLogs() {
      const lines = await window.qbitui?.getLogs();
      if (!cancelled && lines) {
        setLogs(lines);
      }
    }

    void fetchLogs();
    const id = setInterval(fetchLogs, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (isScrolledToBottom.current) {
      bottomRef.current?.scrollIntoView({ behavior: "auto" });
    }
  }, [logs]);

  function handleScroll(e: React.UIEvent<HTMLPreElement>) {
    const el = e.currentTarget;
    isScrolledToBottom.current =
      Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight) < 4;
  }

  async function copyLogs() {
    try {
      await navigator.clipboard.writeText(logs.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <div className="bg-background min-h-screen p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between shrink-0">
        <h1 className="text-foreground text-lg font-bold">Application Logs</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-fg-subtle">{logs.length} lines</span>
          <button
            onClick={copyLogs}
            className="text-xs px-3 py-1.5 rounded bg-raise-strong hover:bg-hover text-foreground hover:text-foreground transition-colors border border-line"
          >
            {copied ? "Copied!" : "Copy all"}
          </button>
        </div>
      </div>
      <pre
        onScroll={handleScroll}
        className="flex-1 text-xs text-positive font-mono bg-raise p-4 rounded overflow-auto"
        style={{ minHeight: 0, maxHeight: "calc(100vh - 80px)" }}
      >
        {logs.length > 0 ? logs.join("\n") : "No log output yet…"}
        <div ref={bottomRef} />
      </pre>
    </div>
  );
}
