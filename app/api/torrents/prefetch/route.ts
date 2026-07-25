import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, IronSessionData } from "@/lib/session";
import { parseTorrentMetadata } from "@/lib/torrent-file";
import { fetchMagnetMetadata } from "@/lib/metadata-api";
import { PrefetchedTorrent } from "@/lib/types";

interface PrefetchFailure {
  id: string;
  error: string;
}

interface PrefetchResult {
  torrents: PrefetchedTorrent[];
  failed: PrefetchFailure[];
}

/**
 * Lists a torrent's contents before it is queued.
 *
 * `.torrent` uploads are parsed here and never touch the network.  Magnet
 * links carry no file list, so their contents come from the metadata API the
 * user configured in Settings; the request is made server-side to keep the
 * browser out of it.
 */
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = await getIronSession<IronSessionData>(cookieStore, sessionOptions);
    if (!session.apiToken || !session.host) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      return NextResponse.json(await prefetchFiles(req));
    }

    const body = await req.json();
    const magnets: unknown = body?.magnets;
    const metadataApi: unknown = body?.metadataApi;

    if (!Array.isArray(magnets) || magnets.length === 0) {
      return NextResponse.json({ error: "No magnet links provided" }, { status: 400 });
    }
    if (typeof metadataApi !== "string" || !metadataApi) {
      return NextResponse.json(
        { error: "No metadata API configured — add one in Settings to list a magnet's files" },
        { status: 400 }
      );
    }

    return NextResponse.json(await prefetchMagnets(metadataApi, magnets.map(String)));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to read torrent metadata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function prefetchFiles(req: NextRequest): Promise<PrefetchResult> {
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

async function prefetchMagnets(metadataApi: string, magnets: string[]): Promise<PrefetchResult> {
  const torrents: PrefetchedTorrent[] = [];
  const failed: PrefetchFailure[] = [];

  for (const magnet of magnets) {
    try {
      const metadata = await fetchMagnetMetadata(metadataApi, magnet);
      torrents.push({
        id: magnet,
        source: "magnet",
        name: metadata.name,
        totalSize: metadata.totalSize,
        files: metadata.files,
        infoHash: metadata.infoHash,
      });
    } catch (error) {
      failed.push({
        id: magnet,
        error: error instanceof Error ? error.message : "Failed to fetch metadata",
      });
    }
  }

  return { torrents, failed };
}
