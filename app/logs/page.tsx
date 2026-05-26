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
    <div className="bg-gray-950 min-h-screen p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between shrink-0">
        <h1 className="text-white text-lg font-bold">Application Logs</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{logs.length} lines</span>
          <button
            onClick={copyLogs}
            className="text-xs px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors border border-white/10"
          >
            {copied ? "Copied!" : "Copy all"}
          </button>
        </div>
      </div>
      <pre
        onScroll={handleScroll}
        className="flex-1 text-xs text-green-400 font-mono bg-black/50 p-4 rounded overflow-auto"
        style={{ minHeight: 0, maxHeight: "calc(100vh - 80px)" }}
      >
        {logs.length > 0 ? logs.join("\n") : "No log output yet…"}
        <div ref={bottomRef} />
      </pre>
    </div>
  );
}
