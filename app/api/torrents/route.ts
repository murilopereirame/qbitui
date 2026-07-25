import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, IronSessionData } from "@/lib/session";
import { QBitAPI } from "@/lib/qbit-api";
import { parseTorrentMetadata } from "@/lib/torrent-file";
import { AddTorrentOptions } from "@/lib/types";

/** Priority 0 means "do not download this file". */
const PRIORITY_SKIP = 0;

async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<IronSessionData>(cookieStore, sessionOptions);
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.apiToken || !session.host) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const url = new URL(req.url);
    const filter = url.searchParams.get("filter") ?? undefined;
    const category = url.searchParams.get("category") ?? undefined;
    const tag = url.searchParams.get("tag") ?? undefined;

    const api = new QBitAPI(session.host, session.apiToken);
    const torrents = await api.getTorrents(filter, category, tag);
    return NextResponse.json(torrents);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch torrents";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.apiToken || !session.host) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const api = new QBitAPI(session.host, session.apiToken);
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("torrents") as File | null;
      if (!file) {
        return NextResponse.json({ error: "No torrent file provided" }, { status: 400 });
      }

      const options = readOptions({
        savepath: formData.get("savepath"),
        category: formData.get("category"),
        tags: formData.get("tags"),
        paused: formData.get("paused"),
      });
      const excludedPaths = readExcludedPaths(formData.get("excludedPaths"));
      const buffer = Buffer.from(await file.arrayBuffer());

      const warning = await addTorrentFile(api, buffer, file.name, options, excludedPaths);
      return NextResponse.json({ success: true, ...(warning ? { warning } : {}) });
    }

    const body = await req.json();
    const options = readOptions(body);

    // Magnets that were already staged by the prefetch step: they are sitting
    // in qBittorrent stopped, so all that is left is to apply the choices.
    if (Array.isArray(body.staged) && body.staged.length > 0) {
      const warnings: string[] = [];
      for (const entry of body.staged as Array<{ hash?: string; excludedPaths?: string[] }>) {
        if (!entry?.hash) continue;
        const warning = await applyStagedTorrent(api, entry.hash, options, entry.excludedPaths ?? []);
        if (warning) warnings.push(warning);
      }
      return NextResponse.json({ success: true, ...(warnings.length ? { warning: warnings.join("; ") } : {}) });
    }

    const { urls } = body;
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: "No magnet URLs provided" }, { status: 400 });
    }

    await api.addMagnet(urls, options);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to add torrent";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function readOptions(source: {
  savepath?: unknown;
  category?: unknown;
  tags?: unknown;
  paused?: unknown;
}): AddTorrentOptions {
  const text = (value: unknown) => (typeof value === "string" && value ? value : undefined);
  return {
    savepath: text(source.savepath),
    category: text(source.category),
    tags: text(source.tags),
    paused: source.paused === true || source.paused === "true",
  };
}

function readExcludedPaths(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Adds a .torrent file, honouring a partial file selection.
 *
 * With a selection the torrent has to be added stopped: file priorities can
 * only be set once qBittorrent knows about the torrent, and starting first
 * would mean briefly downloading files the user deselected.  Returns a
 * human-readable warning when the selection could not be applied.
 */
async function addTorrentFile(
  api: QBitAPI,
  buffer: Buffer,
  fileName: string,
  options: AddTorrentOptions,
  excludedPaths: string[]
): Promise<string | null> {
  if (excludedPaths.length === 0) {
    await api.addTorrentFile(buffer, fileName, options);
    return null;
  }

  let hint: string | null = null;
  try {
    hint = parseTorrentMetadata(new Uint8Array(buffer)).infoHash;
  } catch {
    // Unreadable metadata is not fatal here: qBittorrent may still accept it,
    // we just have to locate the torrent by diffing the list instead.
  }

  const known = new Set((await api.getTorrents()).map((torrent) => torrent.hash));
  await api.addTorrentFile(buffer, fileName, { ...options, paused: true });

  const hash = await api.waitForTorrentHash(known, hint);
  if (!hash) {
    return `${fileName}: added, but the file selection could not be applied (torrent not found)`;
  }

  const skipped = await skipFiles(api, hash, excludedPaths);
  if (!options.paused) await api.resumeTorrents([hash]);
  return skipped ? null : `${fileName}: added, but some deselected files could not be matched`;
}

/** Applies options and the file selection to an already staged magnet. */
async function applyStagedTorrent(
  api: QBitAPI,
  hash: string,
  options: AddTorrentOptions,
  excludedPaths: string[]
): Promise<string | null> {
  let warning: string | null = null;

  if (excludedPaths.length > 0) {
    const skipped = await skipFiles(api, hash, excludedPaths);
    if (!skipped) warning = "Some deselected files could not be matched";
  }

  if (options.savepath) await api.setLocation([hash], options.savepath);
  if (options.category) await api.setCategory([hash], options.category);
  if (options.tags) await api.addTags([hash], options.tags);
  if (!options.paused) await api.resumeTorrents([hash]);

  return warning;
}

/** Marks the given paths as "do not download". Returns false if none matched. */
async function skipFiles(api: QBitAPI, hash: string, excludedPaths: string[]): Promise<boolean> {
  const files = await api.waitForTorrentFiles(hash);
  const excluded = new Set(excludedPaths.map(normalizePath));
  const ids = files.filter((file) => excluded.has(normalizePath(file.name))).map((file) => file.index);
  if (ids.length === 0) return false;
  await api.setFilePriority(hash, ids, PRIORITY_SKIP);
  return ids.length === excluded.size;
}

/** qBittorrent appends .!qB to incomplete files when that option is enabled. */
function normalizePath(path: string): string {
  return path.replace(/\.!qB$/, "");
}
