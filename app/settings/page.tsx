"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Magnet, FileText, Info } from "lucide-react";

interface HandlerRow {
  icon: React.ReactNode;
  title: string;
  description: string;
  status: boolean | null;
  onToggle?: (enabled: boolean) => void;
  note?: string;
}

export default function SettingsPage() {
  const isElectron = typeof window !== "undefined" && !!window.qbitui;
  const [magnetEnabled, setMagnetEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isElectron) return;
    window.qbitui!.getMagnetHandlerStatus().then(setMagnetEnabled).catch(() => setMagnetEnabled(false));
  }, [isElectron]);

  async function toggleMagnet(enable: boolean) {
    if (!isElectron || busy) return;
    setBusy(true);
    try {
      await window.qbitui!.setMagnetHandler(enable);
      setMagnetEnabled(enable);
    } catch {
      // status unchanged
    } finally {
      setBusy(false);
    }
  }

  const rows: HandlerRow[] = [
    {
      icon: <Magnet className="h-5 w-5 text-blue-400" />,
      title: "magnet:// links",
      description: "Open magnet links directly in qbitUI. Clicking a magnet link in your browser will automatically launch qbitUI and begin adding the torrent.",
      status: magnetEnabled,
      onToggle: toggleMagnet,
    },
    {
      icon: <FileText className="h-5 w-5 text-purple-400" />,
      title: ".torrent files",
      description: "Associate .torrent files with qbitUI so that double-clicking a torrent file opens it in qbitUI.",
      status: null,
      note: "File association is configured at install time. Re-install the app to apply or change it.",
    },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-auto p-8">
          <h1 className="text-xl font-bold text-white mb-6">Settings</h1>

          {!isElectron && (
            <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl mb-6 text-sm text-yellow-300">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Protocol handler registration is only available in the desktop application.</span>
            </div>
          )}

          <section>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Default Handler Registration
            </h2>
            <div className="space-y-3">
              {rows.map((row) => (
                <div
                  key={row.title}
                  className="flex items-start gap-4 p-4 bg-gray-900/60 border border-white/10 rounded-xl"
                >
                  <div className="mt-0.5 shrink-0">{row.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-white text-sm mb-1">{row.title}</div>
                    <div className="text-xs text-gray-400 leading-relaxed">{row.description}</div>
                    {row.note && (
                      <div className="flex items-start gap-1.5 mt-2 text-xs text-gray-500">
                        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        {row.note}
                      </div>
                    )}
                  </div>
                  {row.onToggle ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <Label
                        htmlFor={`handler-${row.title}`}
                        className="text-xs text-gray-400 cursor-pointer select-none"
                      >
                        {row.status ? "Registered" : row.status === null ? "Checking…" : "Not registered"}
                      </Label>
                      <Switch
                        id={`handler-${row.title}`}
                        checked={row.status === true}
                        onCheckedChange={row.onToggle}
                        disabled={!isElectron || busy || row.status === null}
                      />
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 shrink-0 mt-0.5 italic">Install-time</div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
