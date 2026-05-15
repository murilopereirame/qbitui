import { Torrent, TransferInfo, AddTorrentOptions } from "./types";

export class QBitAPI {
  private readonly safeHost: string;

  constructor(
    host: string,
    private sid: string
  ) {
    // Re-validate the host from the session to satisfy static analysis:
    // even though it was already validated at login time, we guard here too.
    this.safeHost = validateHost(host);
  }

  private get headers() {
    return {
      Cookie: `SID=${this.sid}`,
      Referer: this.safeHost,
    };
  }

  private url(path: string): string {
    return `${this.safeHost}${path}`;
  }

  async verifyAuth(): Promise<boolean> {
    try {
      const res = await fetch(this.url("/api/v2/app/version"), {
        headers: this.headers,
      });
      return res.ok && res.status !== 403;
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
    const res = await fetch(this.url(`/api/v2/torrents/info${query}`), {
      headers: this.headers,
    });
    if (!res.ok) throw new Error(`Failed to fetch torrents: ${res.status}`);
    return res.json();
  }

  async getTransferInfo(): Promise<TransferInfo> {
    const res = await fetch(this.url("/api/v2/transfer/info"), {
      headers: this.headers,
    });
    if (!res.ok) throw new Error("Failed to fetch transfer info");
    return res.json();
  }

  async getCategories(): Promise<Record<string, { name: string; savePath: string }>> {
    const res = await fetch(this.url("/api/v2/torrents/categories"), {
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
    const res = await fetch(this.url("/api/v2/torrents/add"), {
      method: "POST",
      headers: this.headers,
      body: form,
    });
    if (!res.ok) throw new Error("Failed to add magnet link");
    const text = await res.text();
    if (text !== "Ok.") throw new Error(`qBittorrent error: ${text}`);
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
    const res = await fetch(this.url("/api/v2/torrents/add"), {
      method: "POST",
      headers: this.headers,
      body: form,
    });
    if (!res.ok) throw new Error("Failed to add torrent file");
    const text = await res.text();
    if (text !== "Ok.") throw new Error(`qBittorrent error: ${text}`);
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
    await this.torrentAction("/api/v2/torrents/pause", hashes);
  }

  async resumeTorrents(hashes: string[]): Promise<void> {
    await this.torrentAction("/api/v2/torrents/resume", hashes);
  }

  async deleteTorrents(hashes: string[], deleteFiles: boolean): Promise<void> {
    const form = new FormData();
    form.append("hashes", hashes.join("|"));
    form.append("deleteFiles", deleteFiles ? "true" : "false");
    const res = await fetch(this.url("/api/v2/torrents/delete"), {
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

  private async torrentAction(path: string, hashes: string[]): Promise<void> {
    const form = new FormData();
    form.append("hashes", hashes.join("|"));
    const res = await fetch(this.url(path), {
      method: "POST",
      headers: this.headers,
      body: form,
    });
    if (!res.ok) throw new Error(`Action failed: ${res.status}`);
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

export async function qbitLogin(
  host: string,
  username: string,
  password: string
): Promise<string> {
  const safeHost = validateHost(host);
  const form = new FormData();
  form.append("username", username);
  form.append("password", password);

  const res = await fetch(`${safeHost}/api/v2/auth/login`, {
    method: "POST",
    headers: { Referer: safeHost },
    body: form,
  });

  if (!res.ok) {
    throw new Error(`Login failed: HTTP ${res.status}`);
  }

  const text = await res.text();
  if (text === "Fails.") throw new Error("Invalid username or password");
  if (text.includes("banned")) throw new Error("IP address is banned");
  if (text !== "Ok.") throw new Error(`Unexpected login response: ${text}`);

  const setCookie = res.headers.get("set-cookie") ?? "";
  const sidMatch = setCookie.match(/SID=([^;]+)/);
  if (!sidMatch) throw new Error("No session cookie received from qBittorrent");
  return sidMatch[1];
}
