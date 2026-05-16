import {
  Torrent,
  TransferInfo,
  AddTorrentOptions,
  TorrentProperties,
  TorrentTracker,
  TorrentFile,
} from './types';

export class QBitAPI {
  private readonly safeHost: string;

  constructor(
    host: string,
    private sid: string
  ) {
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
      const res = await fetch(this.url('/api/v2/app/version'), {
        headers: this.headers,
      });
      return res.ok && res.status !== 403;
    } catch {
      return false;
    }
  }

  async getTorrents(): Promise<Torrent[]> {
    const res = await fetch(this.url('/api/v2/torrents/info'), {
      headers: this.headers,
    });
    if (!res.ok) throw new Error(`Failed to fetch torrents: ${res.status}`);
    return res.json();
  }

  async getTransferInfo(): Promise<TransferInfo> {
    const res = await fetch(this.url('/api/v2/transfer/info'), {
      headers: this.headers,
    });
    if (!res.ok) throw new Error('Failed to fetch transfer info');
    return res.json();
  }

  async addMagnet(urls: string[], options: AddTorrentOptions = {}): Promise<void> {
    const form = new FormData();
    form.append('urls', urls.join('\n'));
    this.applyOptions(form, options);
    const res = await fetch(this.url('/api/v2/torrents/add'), {
      method: 'POST',
      headers: this.headers,
      body: form,
    });
    if (!res.ok) throw new Error('Failed to add magnet link');
    const text = await res.text();
    if (text !== 'Ok.') throw new Error(`qBittorrent error: ${text}`);
  }

  private applyOptions(form: FormData, options: AddTorrentOptions) {
    if (options.savepath) form.append('savepath', options.savepath);
    if (options.category) form.append('category', options.category);
    if (options.tags) form.append('tags', options.tags);
    if (options.paused) form.append('paused', 'true');
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
    const res = await fetch(this.url('/api/v2/torrents/delete'), {
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

  async moveTorrentsBottom(hashes: string[]): Promise<void> {
    await this.torrentAction('/api/v2/torrents/bottomPrio', hashes);
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

  private async torrentAction(path: string, hashes: string[]): Promise<void> {
    const form = new FormData();
    form.append('hashes', hashes.join('|'));
    const res = await fetch(this.url(path), {
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

    let res = await fetch(this.url(primaryPath), {
      method: 'POST',
      headers: this.headers,
      body: buildForm(),
    });

    if (res.status === 404) {
      res = await fetch(this.url(fallbackPath), {
        method: 'POST',
        headers: this.headers,
        body: buildForm(),
      });
    }

    if (!res.ok) throw new Error(`Action failed: ${res.status}`);
  }

  private async fetchJson<T>(path: string): Promise<T> {
    const res = await fetch(this.url(path), {
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
    throw new Error('Invalid host URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Host URL must use http or https');
  }
  return parsed.origin;
}

export async function qbitLogin(
  host: string,
  username: string,
  password: string
): Promise<{ sid: string; host: string }> {
  const safeHost = validateHost(host);
  const form = new FormData();
  form.append('username', username);
  form.append('password', password);

  const res = await fetch(`${safeHost}/api/v2/auth/login`, {
    method: 'POST',
    headers: { Referer: safeHost },
    body: form,
  });

  if (!res.ok) {
    throw new Error(`Login failed: HTTP ${res.status}`);
  }

  const text = await res.text();
  if (text === 'Fails.') throw new Error('Invalid username or password');
  if (text.includes('banned')) throw new Error('IP address is banned');
  if (text !== 'Ok.') throw new Error(`Unexpected login response: ${text}`);

  const setCookie = res.headers.get('set-cookie') ?? '';
  const sidMatch = setCookie.match(/SID=([^;]+)/);
  if (!sidMatch) throw new Error('No session cookie received from qBittorrent');
  return { sid: sidMatch[1], host: safeHost };
}
