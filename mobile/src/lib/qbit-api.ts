import {
  Torrent,
  TransferInfo,
  AddTorrentOptions,
  TorrentProperties,
  TorrentTracker,
  TorrentFile,
  Category,
} from './types';
import { logger } from './logger';

type FormDataFileValue = {
  uri: string;
  name: string;
  type: string;
};

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
    const method = (options.method ?? 'GET').toUpperCase();
    try {
      const res = await fetch(url, options);
      const ct = res.headers.get('content-type') ?? '';
      let body: string | undefined;
      if (ct.includes('text') || ct.includes('json')) {
        const text = await res.clone().text();
        body = text.length > 500 ? text.slice(0, 500) + '…' : text;
      }
      logger.info(`${method} ${path} → ${res.status} (${Date.now() - start}ms)`, 'qbit-api', body);
      return res;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`${method} ${path} failed: ${msg}`, 'qbit-api');
      throw err;
    }
  }

  async verifyAuth(): Promise<boolean> {
    try {
      const res = await this.loggedFetch(this.url('/api/v2/app/version'), {
        headers: this.headers,
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async getTorrents(): Promise<Torrent[]> {
    const res = await this.loggedFetch(this.url('/api/v2/torrents/info'), {
      headers: this.headers,
    });
    if (!res.ok) throw new Error(`Failed to fetch torrents: ${res.status}`);
    return res.json();
  }

  async getTransferInfo(): Promise<TransferInfo> {
    const res = await this.loggedFetch(this.url('/api/v2/transfer/info'), {
      headers: this.headers,
    });
    if (!res.ok) throw new Error('Failed to fetch transfer info');
    return res.json();
  }

  async addMagnet(urls: string[], options: AddTorrentOptions = {}): Promise<void> {
    const form = new FormData();
    form.append('urls', urls.join('\n'));
    this.applyOptions(form, options);
    await this.submitTorrentsForm(form);
  }

  async addTorrentFile(
    fileUri: string,
    fileName: string,
    options: AddTorrentOptions = {}
  ): Promise<void> {
    const form = new FormData();
    const file: FormDataFileValue = {
      uri: fileUri,
      name: fileName,
      type: 'application/x-bittorrent',
    };
    form.append('torrents', file as unknown as Blob);
    this.applyOptions(form, options);
    await this.submitTorrentsForm(form);
  }

  private async submitTorrentsForm(form: FormData): Promise<void> {
    const res = await this.loggedFetch(this.url('/api/v2/torrents/add'), {
      method: 'POST',
      headers: this.headers,
      body: form,
    });
    if (!res.ok) throw new Error('Failed to add torrent');
  }

  private applyOptions(form: FormData, options: AddTorrentOptions) {
    if (options.savepath) form.append('savepath', options.savepath);
    if (options.category) form.append('category', options.category);
    if (options.tags) form.append('tags', options.tags);
    // qBittorrent v5 renamed "paused" to "stopped"; send both for compatibility.
    if (options.paused) form.append('stopped', 'true');
    if (options.paused) form.append('paused', 'true');
  }

  async getCategories(): Promise<Record<string, Category>> {
    const res = await this.loggedFetch(this.url('/api/v2/torrents/categories'), {
      headers: this.headers,
    });
    if (!res.ok) return {};
    return res.json();
  }

  async getTags(): Promise<string[]> {
    const res = await this.loggedFetch(this.url('/api/v2/torrents/tags'), {
      headers: this.headers,
    });
    if (!res.ok) return [];
    const tags = await res.json();
    return Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === 'string') : [];
  }

  async createCategory(name: string, savePath = ''): Promise<void> {
    await this.formPost('/api/v2/torrents/createCategory', { category: name, savePath });
  }

  async editCategory(name: string, savePath = ''): Promise<void> {
    await this.formPost('/api/v2/torrents/editCategory', { category: name, savePath });
  }

  /** qBittorrent expects one category name per line. */
  async removeCategories(names: string[]): Promise<void> {
    await this.formPost('/api/v2/torrents/removeCategories', { categories: names.join('\n') });
  }

  async createTags(tags: string[]): Promise<void> {
    await this.formPost('/api/v2/torrents/createTags', { tags: tags.join(',') });
  }

  /** Deletes the tags themselves; torrents carrying them simply lose them. */
  async deleteTags(tags: string[]): Promise<void> {
    await this.formPost('/api/v2/torrents/deleteTags', { tags: tags.join(',') });
  }

  /** An empty category removes the torrents from whichever category they were in. */
  async setCategory(hashes: string[], category: string): Promise<void> {
    await this.formPost('/api/v2/torrents/setCategory', { hashes: hashes.join('|'), category });
  }

  async addTags(hashes: string[], tags: string): Promise<void> {
    await this.formPost('/api/v2/torrents/addTags', { hashes: hashes.join('|'), tags });
  }

  async removeTags(hashes: string[], tags: string): Promise<void> {
    await this.formPost('/api/v2/torrents/removeTags', { hashes: hashes.join('|'), tags });
  }

  async setLocation(hashes: string[], location: string): Promise<void> {
    await this.formPost('/api/v2/torrents/setLocation', { hashes: hashes.join('|'), location });
  }

  /**
   * Waits for a freshly added torrent to show up.  `hint` is the info hash we
   * expect; when it is unknown (or wrong, as for v2-only torrents) we fall
   * back to whichever hash appeared that was not there before.
   */
  async waitForTorrentHash(
    knownHashes: Set<string>,
    hint: string | null,
    timeoutMs = 15_000
  ): Promise<string | null> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const hashes = (await this.getTorrents()).map((torrent) => torrent.hash);
      if (hint && hashes.includes(hint)) return hint;
      const added = hashes.find((hash) => !knownHashes.has(hash));
      if (added) return added;
      await delay(400);
    }
    return null;
  }

  /**
   * Waits for a torrent's metadata to arrive.  Magnet links start out with no
   * file list at all, which is exactly what this is used to wait for.
   */
  async waitForTorrentFiles(hash: string, timeoutMs = 60_000): Promise<TorrentFile[]> {
    const deadline = Date.now() + timeoutMs;
    let lastError: unknown = null;
    while (Date.now() < deadline) {
      try {
        const files = await this.getTorrentFiles(hash);
        if (files.length > 0) return files;
      } catch (error) {
        // The torrent may not be registered yet; keep polling until timeout.
        lastError = error;
      }
      await delay(700);
    }
    if (lastError) throw lastError;
    return [];
  }

  async pauseTorrents(hashes: string[]): Promise<void> {
    await this.torrentActionWithFallback(
      '/api/v2/torrents/stop',
      '/api/v2/torrents/pause',
      hashes
    );
  }

  async resumeTorrents(hashes: string[]): Promise<void> {
    await this.torrentActionWithFallback(
      '/api/v2/torrents/start',
      '/api/v2/torrents/resume',
      hashes
    );
  }

  async deleteTorrents(hashes: string[], deleteFiles: boolean): Promise<void> {
    const form = new FormData();
    form.append('hashes', hashes.join('|'));
    form.append('deleteFiles', deleteFiles ? 'true' : 'false');
    const res = await this.loggedFetch(this.url('/api/v2/torrents/delete'), {
      method: 'POST',
      headers: this.headers,
      body: form,
    });
    if (!res.ok) throw new Error('Failed to delete torrents');
  }

  async recheckTorrents(hashes: string[]): Promise<void> {
    await this.torrentAction('/api/v2/torrents/recheck', hashes);
  }

  async reannounceTorrents(hashes: string[]): Promise<void> {
    await this.torrentAction('/api/v2/torrents/reannounce', hashes);
  }

  async moveTorrentsTop(hashes: string[]): Promise<void> {
    await this.torrentAction('/api/v2/torrents/topPrio', hashes);
  }

  async moveTorrentsUp(hashes: string[]): Promise<void> {
    await this.torrentAction('/api/v2/torrents/increasePrio', hashes);
  }

  async moveTorrentsDown(hashes: string[]): Promise<void> {
    await this.torrentAction('/api/v2/torrents/decreasePrio', hashes);
  }

  async moveTorrentsBottom(hashes: string[]): Promise<void> {
    await this.torrentAction('/api/v2/torrents/bottomPrio', hashes);
  }

  /** Builds the authenticated request needed to download a torrent's .torrent file. */
  buildExportRequest(hash: string): { url: string; headers: Record<string, string> } {
    const params = new URLSearchParams({ hash });
    return {
      url: this.url(`/api/v2/torrents/export?${params}`),
      headers: { ...this.headers },
    };
  }

  async getTorrentProperties(hash: string): Promise<TorrentProperties> {
    const params = new URLSearchParams({ hash });
    return this.fetchJson<TorrentProperties>(`/api/v2/torrents/properties?${params}`);
  }

  async getTorrentTrackers(hash: string): Promise<TorrentTracker[]> {
    const params = new URLSearchParams({ hash });
    return this.fetchJson<TorrentTracker[]>(`/api/v2/torrents/trackers?${params}`);
  }

  async getTorrentFiles(hash: string): Promise<TorrentFile[]> {
    const params = new URLSearchParams({ hash });
    return this.fetchJson<TorrentFile[]>(`/api/v2/torrents/files?${params}`);
  }

  async setFilePriority(hash: string, fileIds: number[], priority: number): Promise<void> {
    const form = new FormData();
    form.append('hash', hash);
    form.append('id', fileIds.join('|'));
    form.append('priority', String(priority));
    const res = await this.loggedFetch(this.url('/api/v2/torrents/filePrio'), {
      method: 'POST',
      headers: this.headers,
      body: form,
    });
    if (!res.ok) throw new Error(`Failed to change file priority: ${res.status}`);
  }

  /**
   * qBittorrent answers 409 with a plain-text reason for rejected names
   * ("Category name is invalid"), so that body is preferred over the status.
   */
  private async formPost(path: string, fields: Record<string, string>): Promise<void> {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.append(key, value);
    const res = await this.loggedFetch(this.url(path), {
      method: 'POST',
      headers: this.headers,
      body: form,
    });
    if (res.ok) return;
    const reason = (await res.text().catch(() => '')).trim();
    throw new Error(reason || `Request to ${path} failed: ${res.status}`);
  }

  private async torrentAction(path: string, hashes: string[]): Promise<void> {
    const form = new FormData();
    form.append('hashes', hashes.join('|'));
    const res = await this.loggedFetch(this.url(path), {
      method: 'POST',
      headers: this.headers,
      body: form,
    });
    if (!res.ok) throw new Error(`Action failed: ${res.status}`);
  }

  private async torrentActionWithFallback(
    primaryPath: string,
    fallbackPath: string,
    hashes: string[]
  ): Promise<void> {
    const buildForm = () => {
      const form = new FormData();
      form.append('hashes', hashes.join('|'));
      return form;
    };

    let res = await this.loggedFetch(this.url(primaryPath), {
      method: 'POST',
      headers: this.headers,
      body: buildForm(),
    });

    if (res.status === 404) {
      res = await this.loggedFetch(this.url(fallbackPath), {
        method: 'POST',
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function validateHost(host: string): string {
  let parsed: URL;
  try {
    parsed = new URL(host);
  } catch {
    throw new Error('Invalid host URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Host URL must use http or https');
  }
  return parsed.origin;
}

export async function verifyApiToken(host: string, apiToken: string): Promise<string> {
  const safeHost = validateHost(host);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`${safeHost}/api/v2/app/version`, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        Referer: safeHost,
      },
      signal: controller.signal,
    });
    if (res.status === 403) throw new Error('Invalid API token');
    if (!res.ok) throw new Error(`Could not reach qBittorrent: HTTP ${res.status}`);
    return safeHost;
  } finally {
    clearTimeout(timeoutId);
  }
}
