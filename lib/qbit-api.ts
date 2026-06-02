import {
  Torrent,
  TransferInfo,
  AddTorrentOptions,
  TorrentProperties,
  TorrentTracker,
  TorrentPeer,
  TorrentFile,
} from "./types";
import { addRequestLog } from "./request-log";

export class QBitAPI {
  private readonly safeHost: string;

  constructor(
    host: string,
    private apiToken: string
  ) {
    this.safeHost = validateHost(host);
  }

  private get headers() {
    return {
      Authorization: `Bearer ${this.apiToken}`,
      Referer: this.safeHost,
    };
  }

  private url(path: string): string {
    return `${this.safeHost}${path}`;
  }

  private async loggedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const start = Date.now();
    const path = new URL(url).pathname + new URL(url).search;
    const method = (options.method ?? "GET").toUpperCase();
    try {
      const res = await fetch(url, options);
      const ct = res.headers.get("content-type") ?? "";
      let body: string | undefined;
      if (ct.includes("text") || ct.includes("json")) {
        const text = await res.clone().text();
        body = text.length > 500 ? text.slice(0, 500) + "…" : text;
      }
      addRequestLog({ timestamp: new Date().toISOString(), method, path, status: res.status, duration: Date.now() - start, body });
      return res;
    } catch (err) {
      addRequestLog({ timestamp: new Date().toISOString(), method, path, status: null, duration: Date.now() - start, error: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  }

  async verifyAuth(): Promise<boolean> {
    try {
      const res = await this.loggedFetch(this.url("/api/v2/app/version"), {
        headers: this.headers,
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async getTorrents(filter?: string, category?: string, tag?: string): Promise<Torrent[]> {
    const params = new URLSearchParams();
    if (filter && filter !== "all") params.set("filter", filter);
    if (category) params.set("category", category);
    if (tag) params.set("tag", tag);
    const query = params.toString() ? `?${params}` : "";
    const res = await this.loggedFetch(this.url(`/api/v2/torrents/info${query}`), {
      headers: this.headers,
    });
    if (!res.ok) throw new Error(`Failed to fetch torrents: ${res.status}`);
    return res.json();
  }

  async getTransferInfo(): Promise<TransferInfo> {
    const res = await this.loggedFetch(this.url("/api/v2/transfer/info"), {
      headers: this.headers,
    });
    if (!res.ok) throw new Error("Failed to fetch transfer info");
    return res.json();
  }

  async getCategories(): Promise<Record<string, { name: string; savePath: string }>> {
    const res = await this.loggedFetch(this.url("/api/v2/torrents/categories"), {
      headers: this.headers,
    });
    if (!res.ok) return {};
    return res.json();
  }

  async addMagnet(
    urls: string[],
    options: AddTorrentOptions = {}
  ): Promise<void> {
    const form = new FormData();
    form.append("urls", urls.join("\n"));
    this.applyOptions(form, options);
    const res = await this.loggedFetch(this.url("/api/v2/torrents/add"), {
      method: "POST",
      headers: this.headers,
      body: form,
    });
    if (!res.ok) throw new Error("Failed to add magnet link");
  }

  async addTorrentFile(
    fileBuffer: Buffer,
    fileName: string,
    options: AddTorrentOptions = {}
  ): Promise<void> {
    const form = new FormData();
    const blob = new Blob([fileBuffer.buffer as ArrayBuffer], { type: "application/x-bittorrent" });
    form.append("torrents", blob, fileName);
    this.applyOptions(form, options);
    const res = await this.loggedFetch(this.url("/api/v2/torrents/add"), {
      method: "POST",
      headers: this.headers,
      body: form,
    });
    if (!res.ok) throw new Error("Failed to add torrent file");
  }

  private applyOptions(form: FormData, options: AddTorrentOptions) {
    if (options.savepath) form.append("savepath", options.savepath);
    if (options.category) form.append("category", options.category);
    if (options.tags) form.append("tags", options.tags);
    if (options.paused) form.append("paused", "true");
    if (options.sequentialDownload) form.append("sequentialDownload", "true");
    if (options.firstLastPiecePrio) form.append("firstLastPiecePrio", "true");
    if (options.autoTMM !== undefined) form.append("autoTMM", options.autoTMM ? "true" : "false");
  }

  async pauseTorrents(hashes: string[]): Promise<void> {
    await this.torrentActionWithFallback(
      "/api/v2/torrents/stop",
      "/api/v2/torrents/pause",
      hashes
    );
  }

  async resumeTorrents(hashes: string[]): Promise<void> {
    await this.torrentActionWithFallback(
      "/api/v2/torrents/start",
      "/api/v2/torrents/resume",
      hashes
    );
  }

  async deleteTorrents(hashes: string[], deleteFiles: boolean): Promise<void> {
    const form = new FormData();
    form.append("hashes", hashes.join("|"));
    form.append("deleteFiles", deleteFiles ? "true" : "false");
    const res = await this.loggedFetch(this.url("/api/v2/torrents/delete"), {
      method: "POST",
      headers: this.headers,
      body: form,
    });
    if (!res.ok) throw new Error("Failed to delete torrents");
  }

  async recheckTorrents(hashes: string[]): Promise<void> {
    await this.torrentAction("/api/v2/torrents/recheck", hashes);
  }

  async reannounceTorrents(hashes: string[]): Promise<void> {
    await this.torrentAction("/api/v2/torrents/reannounce", hashes);
  }

  async moveTorrentsTop(hashes: string[]): Promise<void> {
    await this.torrentAction("/api/v2/torrents/topPrio", hashes);
  }

  async moveTorrentsUp(hashes: string[]): Promise<void> {
    await this.torrentAction("/api/v2/torrents/increasePrio", hashes);
  }

  async moveTorrentsDown(hashes: string[]): Promise<void> {
    await this.torrentAction("/api/v2/torrents/decreasePrio", hashes);
  }

  async moveTorrentsBottom(hashes: string[]): Promise<void> {
    await this.torrentAction("/api/v2/torrents/bottomPrio", hashes);
  }

  async exportTorrent(hash: string): Promise<ArrayBuffer> {
    const params = new URLSearchParams({ hash });
    const res = await this.loggedFetch(this.url(`/api/v2/torrents/export?${params}`), {
      headers: this.headers,
    });
    if (!res.ok) throw new Error(`Failed to export torrent: ${res.status}`);
    return res.arrayBuffer();
  }

  async getTorrentProperties(hash: string): Promise<TorrentProperties> {
    const params = new URLSearchParams({ hash });
    return this.fetchJson<TorrentProperties>(`/api/v2/torrents/properties?${params}`);
  }

  async getTorrentTrackers(hash: string): Promise<TorrentTracker[]> {
    const params = new URLSearchParams({ hash });
    return this.fetchJson<TorrentTracker[]>(`/api/v2/torrents/trackers?${params}`);
  }

  async getTorrentPeers(hash: string): Promise<TorrentPeer[]> {
    const params = new URLSearchParams({ hash });
    const data = await this.fetchJson<{ peers: Record<string, TorrentPeer> }>(`/api/v2/sync/torrentPeers?${params}`);
    return Object.values(data.peers ?? {});
  }

  async getTorrentWebSeeds(hash: string): Promise<string[]> {
    const params = new URLSearchParams({ hash });
    const data = await this.fetchJson<Array<{ url?: string } | string>>(`/api/v2/torrents/webseeds?${params}`);
    return data
      .map((seed) => (typeof seed === "string" ? seed : seed.url ?? ""))
      .filter(Boolean);
  }

  async getTorrentFiles(hash: string): Promise<TorrentFile[]> {
    const params = new URLSearchParams({ hash });
    return this.fetchJson<TorrentFile[]>(`/api/v2/torrents/files?${params}`);
  }

  async setFilePriority(hash: string, fileIds: number[], priority: number): Promise<void> {
    const form = new FormData();
    form.append("hash", hash);
    form.append("id", fileIds.join("|"));
    form.append("priority", String(priority));
    const res = await this.loggedFetch(this.url("/api/v2/torrents/filePrio"), {
      method: "POST",
      headers: this.headers,
      body: form,
    });
    if (!res.ok) throw new Error(`Failed to change file priority: ${res.status}`);
  }

  private async torrentAction(path: string, hashes: string[]): Promise<void> {
    const form = new FormData();
    form.append("hashes", hashes.join("|"));
    const res = await this.loggedFetch(this.url(path), {
      method: "POST",
      headers: this.headers,
      body: form,
    });
    if (!res.ok) throw new Error(`Action failed: ${res.status}`);
  }

  private async torrentActionWithFallback(primaryPath: string, fallbackPath: string, hashes: string[]): Promise<void> {
    const buildForm = () => {
      const form = new FormData();
      form.append("hashes", hashes.join("|"));
      return form;
    };

    let res = await this.loggedFetch(this.url(primaryPath), {
      method: "POST",
      headers: this.headers,
      body: buildForm(),
    });

    if (res.status === 404) {
      res = await this.loggedFetch(this.url(fallbackPath), {
        method: "POST",
        headers: this.headers,
        body: buildForm(),
      });
    }

    if (!res.ok) throw new Error(`Action failed: ${res.status}`);
  }

  private async fetchJson<T>(path: string): Promise<T> {
    const res = await this.loggedFetch(this.url(path), {
      headers: this.headers,
    });
    if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
    return res.json() as Promise<T>;
  }
}

export function validateHost(host: string): string {
  let parsed: URL;
  try {
    parsed = new URL(host);
  } catch {
    throw new Error("Invalid host URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Host URL must use http or https");
  }
  return parsed.origin;
}

export async function verifyApiToken(
  host: string,
  apiToken: string
): Promise<string> {
  const safeHost = validateHost(host);
  let lastNetworkError: Error | null = null;

  for (const candidate of getHostCandidates(safeHost)) {
    try {
      const res = await fetch(`${candidate}/api/v2/app/version`, {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          Referer: candidate,
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) return candidate;
      if (res.status === 403) throw new Error("Invalid API token");
      throw new Error(`qBittorrent returned HTTP ${res.status}`);
    } catch (error) {
      if (error instanceof Error && isRetriableNetworkError(error)) {
        lastNetworkError = error;
        continue;
      }
      throw error;
    }
  }

  throw new Error(
    lastNetworkError
      ? `Could not reach qBittorrent WebUI at ${safeHost}: ${lastNetworkError.message}`
      : `Could not reach qBittorrent WebUI at ${safeHost}`
  );
}

function getHostCandidates(host: string): string[] {
  const parsed = new URL(host);
  const normalizedHostname = parsed.hostname.replace(/^\[(.*)\]$/, "$1");
  const candidates = new Set<string>([parsed.origin]);
  const hostnames =
    normalizedHostname === "localhost"
      ? ["127.0.0.1", "::1"]
      : normalizedHostname === "127.0.0.1" || normalizedHostname === "::1"
        ? ["localhost"]
        : [];

  for (const hostname of hostnames) {
    const candidate = new URL(parsed.origin);
    candidate.hostname = hostname;
    candidates.add(candidate.origin);
  }

  return [...candidates];
}

function isRetriableNetworkError(error: Error): boolean {
  return error.name === "TimeoutError" || error.name === "TypeError";
}
