"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ThemeModeSelector } from "@/components/theme/ThemeToggle";
import { Magnet, FileText, Info, Palette } from "lucide-react";

interface HandlerState {
  status: boolean | null; // null = loading
  busy: boolean;
}

export default function SettingsPage() {
  const isElectron = typeof window !== "undefined" && !!window.qbitui;
  const isMac = typeof window !== "undefined" && /Mac/.test(navigator.platform);

  const [magnet, setMagnet] = useState<HandlerState>({ status: null, busy: false });
  const [torrent, setTorrent] = useState<HandlerState>({ status: null, busy: false });

  useEffect(() => {
    if (!isElectron) return;
    window.qbitui!.getMagnetHandlerStatus()
      .then((s) => setMagnet((p) => ({ ...p, status: s })))
      .catch(() => setMagnet((p) => ({ ...p, status: false })));
    window.qbitui!.getTorrentHandlerStatus()
      .then((s) => setTorrent((p) => ({ ...p, status: s })))
      .catch(() => setTorrent((p) => ({ ...p, status: false })));
  }, [isElectron]);

  async function toggleMagnet(enable: boolean) {
    if (!isElectron || magnet.busy) return;
    setMagnet((p) => ({ ...p, busy: true }));
    try {
      await window.qbitui!.setMagnetHandler(enable);
      setMagnet({ status: enable, busy: false });
    } catch {
      setMagnet((p) => ({ ...p, busy: false }));
    }
  }

  async function toggleTorrent(enable: boolean) {
    if (!isElectron || torrent.busy) return;
    setTorrent((p) => ({ ...p, busy: true }));
    try {
      await window.qbitui!.setTorrentHandler(enable);
      setTorrent({ status: enable, busy: false });
    } catch {
      setTorrent((p) => ({ ...p, busy: false }));
    }
  }

  function handlerLabel(state: HandlerState) {
    if (state.status === null) return "Checking…";
    return state.status ? "Registered" : "Not registered";
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-auto p-8">
          <h1 className="text-xl font-bold text-foreground mb-6">Settings</h1>

          <section className="mb-8">
            <h2 className="text-sm font-semibold text-fg-muted uppercase tracking-wider mb-4">
              Appearance
            </h2>
            <div className="flex items-start gap-4 p-4 bg-surface border border-line rounded-xl">
              <div className="mt-0.5 shrink-0">
                <Palette className="h-5 w-5 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground text-sm mb-1">Theme</div>
                <div className="text-xs text-fg-muted leading-relaxed mb-3">
                  Choose the light or dark appearance, or follow whatever your operating system is set to.
                </div>
                <ThemeModeSelector />
              </div>
            </div>
          </section>

          {!isElectron && (
            <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl mb-6 text-sm text-yellow-700 dark:text-yellow-300">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Protocol handler registration is only available in the desktop application.</span>
            </div>
          )}

          <section>
            <h2 className="text-sm font-semibold text-fg-muted uppercase tracking-wider mb-4">
              Default Handler Registration
            </h2>
            <div className="space-y-3">

              {/* magnet:// */}
              <div className="flex items-start gap-4 p-4 bg-surface border border-line rounded-xl">
                <div className="mt-0.5 shrink-0">
                  <Magnet className="h-5 w-5 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground text-sm mb-1">magnet:// links</div>
                  <div className="text-xs text-fg-muted leading-relaxed">
                    Open magnet links directly in qbitUI. Clicking a magnet link in your browser will automatically launch qbitUI and begin adding the torrent.
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Label
                    htmlFor="handler-magnet"
                    className="text-xs text-fg-muted cursor-pointer select-none"
                  >
                    {handlerLabel(magnet)}
                  </Label>
                  <Switch
                    id="handler-magnet"
                    checked={magnet.status === true}
                    onCheckedChange={toggleMagnet}
                    disabled={!isElectron || magnet.busy || magnet.status === null}
                  />
                </div>
              </div>

              {/* .torrent files */}
              <div className="flex items-start gap-4 p-4 bg-surface border border-line rounded-xl">
                <div className="mt-0.5 shrink-0">
                  <FileText className="h-5 w-5 text-purple-500 dark:text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground text-sm mb-1">.torrent files</div>
                  <div className="text-xs text-fg-muted leading-relaxed">
                    Associate .torrent files with qbitUI so that double-clicking a torrent file opens it in qbitUI.
                  </div>
                  {torrent.status === true && isMac && (
                    <div className="flex items-start gap-1.5 mt-2 text-xs text-fg-subtle">
                      <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      Registered. To set qbitUI as the default, right-click any .torrent file → Open With → qbitUI → &quot;Always Open With&quot;.
                    </div>
                  )}
                  {!isMac && isElectron && (
                    <div className="flex items-start gap-1.5 mt-2 text-xs text-fg-subtle">
                      <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      File association is managed by the installer on this platform.
                    </div>
                  )}
                </div>
                {isMac ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <Label
                      htmlFor="handler-torrent"
                      className="text-xs text-fg-muted cursor-pointer select-none"
                    >
                      {handlerLabel(torrent)}
                    </Label>
                    <Switch
                      id="handler-torrent"
                      checked={torrent.status === true}
                      onCheckedChange={toggleTorrent}
                      disabled={!isElectron || torrent.busy || torrent.status === null}
                    />
                  </div>
                ) : (
                  <div className="text-xs text-fg-subtle shrink-0 mt-0.5 italic">Install-time</div>
                )}
              </div>

            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
