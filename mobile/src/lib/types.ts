export interface Torrent {
  hash: string;
  name: string;
  size: number;
  progress: number;
  dlspeed: number;
  upspeed: number;
  num_seeds: number;
  num_leechs: number;
  num_complete: number;
  num_incomplete: number;
  ratio: number;
  eta: number;
  state: TorrentState;
  category: string;
  tags: string;
  save_path: string;
  content_path: string;
  magnet_uri: string;
  added_on: number;
  completion_on: number;
  downloaded: number;
  uploaded: number;
  priority: number;
  amount_left: number;
  availability: number;
  seeding_time: number;
  last_activity: number;
  tracker: string;
  trackers_count: number;
}

export type TorrentState =
  | "downloading"
  | "uploading"
  | "pausedDL"
  | "pausedUP"
  | "stoppedDL"
  | "stoppedUP"
  | "stalledDL"
  | "stalledUP"
  | "checkingDL"
  | "checkingUP"
  | "checkingResumeData"
  | "queuedDL"
  | "queuedUP"
  | "error"
  | "missingFiles"
  | "allocating"
  | "metaDL"
  | "forcedDL"
  | "forcedUP"
  | "moving";

export type TorrentFilter =
  | "all"
  | "downloading"
  | "seeding"
  | "paused"
  | "completed"
  | "error";

export type TorrentAction =
  | "pause"
  | "resume"
  | "delete"
  | "recheck"
  | "reannounce"
  | "topPrio"
  | "increasePrio"
  | "decreasePrio"
  | "bottomPrio";

/** A qBittorrent category and the save path torrents assigned to it default to. */
export interface Category {
  name: string;
  savePath: string;
}

/**
 * Category/tag selection on the torrent list.  `null` means "don't filter";
 * the empty string means "torrents without a category / without any tag",
 * matching how qBittorrent itself reports them.
 */
export type TaxonomyFilter = string | null;

export interface TransferInfo {
  dl_info_speed: number;
  dl_info_data: number;
  up_info_speed: number;
  up_info_data: number;
  dl_rate_limit: number;
  up_rate_limit: number;
  dht_nodes: number;
  connection_status: string;
}

export interface AddTorrentOptions {
  savepath?: string;
  category?: string;
  tags?: string;
  paused?: boolean;
}

export interface TorrentProperties {
  time_elapsed: number;
  eta: number;
  nb_connections: number;
  nb_connections_limit: number;
  total_downloaded: number;
  total_uploaded: number;
  seeds: number;
  seeds_total: number;
  peers: number;
  peers_total: number;
  dl_speed: number;
  up_speed: number;
  dl_limit: number;
  up_limit: number;
  total_wasted: number;
  share_ratio: number;
  reannounce: number;
  last_seen: number;
  popularity: number;
  total_size: number;
  pieces_num: number;
  piece_size: number;
  created_by: string;
  addition_date: number;
  completion_date: number;
  creation_date: number;
  private: boolean;
  infohash_v1: string;
  infohash_v2: string;
  save_path: string;
  comment: string;
}

export interface TorrentTracker {
  tier: number;
  url: string;
  status: number;
  msg: string;
  num_peers: number;
  num_seeds: number;
  num_leeches: number;
  num_downloaded: number;
}

export interface TorrentFile {
  index: number;
  name: string;
  size: number;
  progress: number;
  priority: number;
  availability: number;
}

export interface Credentials {
  host: string;
  username: string;
  sid: string;
}
