import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, IronSessionData } from "@/lib/session";
import { QBitAPI } from "@/lib/qbit-api";
import { magnetInfoHash, parseTorrentMetadata } from "@/lib/torrent-file";
import { AddTorrentOptions } from "@/lib/types";

/** Priority 0 means "do not download this file". */
const PRIORITY_SKIP = 0;

/** How long to wait for a stopped magnet's metadata before starting it. */
const STOPPED_METADATA_TIMEOUT_MS = 10_000;
const RUNNING_METADATA_TIMEOUT_MS = 60_000;

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

    const { urls } = body;
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: "No magnet URLs provided" }, { status: 400 });
    }

    // Magnets whose files the user picked are added one by one so the
    // selection can be applied; the rest go in as one batch.
    const selections = readSelections(body.excludedPaths);
    const plain = urls.filter((url: string) => !selections[url]?.length);
    const warnings: string[] = [];

    if (plain.length > 0) await api.addMagnet(plain, options);
    for (const url of urls) {
      const excluded = selections[url];
      if (!excluded?.length) continue;
      const warning = await addMagnetWithSelection(api, url, options, excluded);
      if (warning) warnings.push(warning);
    }

    return NextResponse.json({
      success: true,
      ...(warnings.length ? { warning: warnings.join("; ") } : {}),
    });
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

/** Per-magnet file exclusions, keyed by magnet URL. */
function readSelections(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== "object") return {};
  const result: Record<string, string[]> = {};
  for (const [url, paths] of Object.entries(value as Record<string, unknown>)) {
    if (Array.isArray(paths)) {
      result[url] = paths.filter((entry): entry is string => typeof entry === "string");
    }
  }
  return result;
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

/**
 * Adds a magnet link and skips the files the user deselected.
 *
 * File priorities can only be set once qBittorrent has the torrent's
 * metadata, which a magnet only gets from peers.  The torrent therefore goes
 * in stopped and is started if the metadata does not turn up that way —
 * qBittorrent fetches metadata before any file data, so the deselected files
 * are marked before they would be written.
 */
async function addMagnetWithSelection(
  api: QBitAPI,
  url: string,
  options: AddTorrentOptions,
  excludedPaths: string[]
): Promise<string | null> {
  const known = new Set((await api.getTorrents()).map((torrent) => torrent.hash));
  await api.addMagnet([url], { ...options, paused: true });

  const hash = await api.waitForTorrentHash(known, magnetInfoHash(url));
  if (!hash) {
    return "Magnet added, but the file selection could not be applied (torrent not found)";
  }

  let files = await api.waitForTorrentFiles(hash, STOPPED_METADATA_TIMEOUT_MS);
  if (files.length === 0) {
    // Some setups only fetch metadata once the torrent is running.
    await api.resumeTorrents([hash]);
    files = await api.waitForTorrentFiles(hash, RUNNING_METADATA_TIMEOUT_MS);
  }

  let warning: string | null = null;
  if (files.length === 0) {
    warning = "Magnet added, but its metadata never arrived — no files were skipped";
  } else if (!(await skipFiles(api, hash, excludedPaths))) {
    warning = "Magnet added, but some deselected files could not be matched";
  }

  if (options.paused) await api.pauseTorrents([hash]);
  else await api.resumeTorrents([hash]);

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
