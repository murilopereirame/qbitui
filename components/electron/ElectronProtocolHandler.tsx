"use client";

/**
 * ElectronProtocolHandler
 *
 * Lives in the root layout (always mounted, regardless of route).
 * Handles open-file (.torrent) and open-url (magnet://) events from Electron's
 * main process and bridges them into Zustand state so that AddTorrentModal can
 * react to them from whichever page it happens to be on.
 *
 * The component covers three timing scenarios:
 *  1. Cold-start file open (open-file fired before the window was ready) –
 *     handled by the drain on mount via consumePendingOpenFile / consumePendingOpenUrl.
 *  2. App is running, user on dashboard – handled by the real-time onOpenFile /
 *     onOpenUrl subscription (this component is always mounted so the listener is
 *     always active, unlike the old approach where the listener lived only inside
 *     AddTorrentModal on /dashboard).
 *  3. App is running, user on a different page (settings, login, …) – also handled
 *     by the always-active real-time subscription.  The modal state is set in Zustand
 *     so the modal opens the moment the user lands on /dashboard.
 */

import { useEffect } from "react";
import { useUIStore } from "@/store";

export function ElectronProtocolHandler() {
  const { setAddModalOpen, setPendingMagnet, setPendingTorrentFile } = useUIStore();

  useEffect(() => {
    if (typeof window === "undefined" || !window.qbitui) return;

    // -----------------------------------------------------------------------
    // Drain: pick up any events that arrived before this component mounted
    // (e.g. the app was launched by double-clicking a .torrent file).
    // -----------------------------------------------------------------------
    void (async () => {
      const url = await window.qbitui!.consumePendingOpenUrl();
      if (url?.startsWith("magnet:")) {
        setPendingMagnet(url);
        setAddModalOpen(true);
      }
      const file = await window.qbitui!.consumePendingOpenFile();
      if (file) {
        setPendingTorrentFile(file);
        setAddModalOpen(true);
      }
    })();

    // -----------------------------------------------------------------------
    // Real-time: subscribe for events while the app is running.
    // -----------------------------------------------------------------------
    const unsubUrl = window.qbitui!.onOpenUrl((url) => {
      if (url.startsWith("magnet:")) {
        setPendingMagnet(url);
        setAddModalOpen(true);
      }
    });

    const unsubFile = window.qbitui!.onOpenFile((file) => {
      setPendingTorrentFile(file);
      setAddModalOpen(true);
    });

    return () => {
      unsubUrl?.();
      unsubFile?.();
    };
  }, [setAddModalOpen, setPendingMagnet, setPendingTorrentFile]);

  return null;
}
