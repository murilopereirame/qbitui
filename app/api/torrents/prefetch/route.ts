import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, IronSessionData } from "@/lib/session";
import { QBitAPI } from "@/lib/qbit-api";
import { magnetInfoHash, parseTorrentMetadata } from "@/lib/torrent-file";
import { PrefetchedTorrent } from "@/lib/types";

/** Give up on magnet metadata after this long; peers may simply not answer. */
const MAGNET_METADATA_TIMEOUT_MS = 60_000;

interface PrefetchFailure {
  id: string;
  error: string;
}

async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<IronSessionData>(cookieStore, sessionOptions);
}

/**
 * Lists a torrent's contents before it is queued.
 *
 * `.torrent` uploads are parsed here and never touch qBittorrent.  Magnet
 * links have no local metadata, so they are staged instead: added in a
 * stopped state, polled until their file list arrives, and left stopped until
 * the user confirms (or cancels, which deletes them again).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.apiToken || !session.host) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      return NextResponse.json(await prefetchFiles(req));
    }

    const body = await req.json();
    const magnets: unknown = body?.magnets;
    if (!Array.isArray(magnets) || magnets.length === 0) {
      return NextResponse.json({ error: "No magnet links provided" }, { status: 400 });
    }

    const api = new QBitAPI(session.host, session.apiToken);
    return NextResponse.json(await prefetchMagnets(api, magnets.map(String)));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to read torrent metadata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Drops magnets that were staged but never confirmed. */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.apiToken || !session.host) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { hashes } = (await req.json()) as { hashes?: string[] };
    if (!Array.isArray(hashes) || hashes.length === 0) {
      return NextResponse.json({ error: "No hashes provided" }, { status: 400 });
    }

    const api = new QBitAPI(session.host, session.apiToken);
    await api.deleteTorrents(hashes, true);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to discard staged torrents";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function prefetchFiles(
  req: NextRequest
): Promise<{ torrents: PrefetchedTorrent[]; failed: PrefetchFailure[] }> {
  const formData = await req.formData();
  const torrents: PrefetchedTorrent[] = [];
  const failed: PrefetchFailure[] = [];

  for (const entry of formData.getAll("torrents")) {
    if (!(entry instanceof File)) continue;
    try {
      const metadata = parseTorrentMetadata(new Uint8Array(await entry.arrayBuffer()));
      torrents.push({
        id: entry.name,
        source: "file",
        name: metadata.name,
        totalSize: metadata.totalSize,
        files: metadata.files,
        infoHash: metadata.infoHash,
      });
    } catch (error) {
      failed.push({
        id: entry.name,
        error: error instanceof Error ? error.message : "Could not read torrent file",
      });
    }
  }

  return { torrents, failed };
}

async function prefetchMagnets(
  api: QBitAPI,
  magnets: string[]
): Promise<{ torrents: PrefetchedTorrent[]; failed: PrefetchFailure[] }> {
  const torrents: PrefetchedTorrent[] = [];
  const failed: PrefetchFailure[] = [];

  for (const magnet of magnets) {
    let hash: string | null = null;
    try {
      const known = new Set((await api.getTorrents()).map((torrent) => torrent.hash));
      const hint = magnetInfoHash(magnet);
      if (hint && known.has(hint)) {
        failed.push({ id: magnet, error: "This torrent is already in qBittorrent" });
        continue;
      }

      await api.addMagnet([magnet], { paused: true });
      hash = await api.waitForTorrentHash(known, hint);
      if (!hash) {
        failed.push({ id: magnet, error: "qBittorrent did not accept the magnet link" });
        continue;
      }

      const files = await api.waitForTorrentFiles(hash, MAGNET_METADATA_TIMEOUT_MS);
      if (files.length === 0) {
        await api.deleteTorrents([hash], true);
        failed.push({ id: magnet, error: "Timed out waiting for metadata from peers" });
        continue;
      }

      const info = (await api.getTorrents()).find((torrent) => torrent.hash === hash);
      torrents.push({
        id: magnet,
        source: "magnet",
        name: info?.name ?? files[0].name.split("/")[0],
        totalSize: files.reduce((total, file) => total + file.size, 0),
        files: files.map((file) => ({ index: file.index, path: file.name, size: file.size })),
        stagedHash: hash,
      });
    } catch (error) {
      // Never leave a half-staged torrent behind.
      if (hash) await api.deleteTorrents([hash], true).catch(() => {});
      failed.push({
        id: magnet,
        error: error instanceof Error ? error.message : "Failed to fetch metadata",
      });
    }
  }

  return { torrents, failed };
}
