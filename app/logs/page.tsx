"use client";

import { useEffect, useRef, useState } from "react";

export default function LogsPage() {
  const [logs, setLogs] = useState<string[]>([]);
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

  // Auto-scroll to bottom only when the user is already at the bottom.
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

  return (
    <div className="bg-gray-950 min-h-screen p-4 flex flex-col">
      <h1 className="text-white text-lg font-bold mb-4 shrink-0">
        Embedded Server Logs
      </h1>
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
