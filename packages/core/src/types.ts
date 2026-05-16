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
  // qBittorrent v5 renames: stopped = was paused in v4
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

export type TorrentFilter = "all" | "downloading" | "seeding" | "paused" | "completed" | "error";

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

export interface SessionData {
  host: string;
  sid: string;
  username: string;
}

export interface AddTorrentOptions {
  savepath?: string;
  category?: string;
  tags?: string;
  paused?: boolean;
  sequentialDownload?: boolean;
  firstLastPiecePrio?: boolean;
  autoTMM?: boolean;
}

export interface ApiError {
  error: string;
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

export interface TorrentPeer {
  country: string;
  ip: string;
  port: number;
  connection: string;
  flags: string;
  client: string;
  progress: number;
  dl_speed: number;
  up_speed: number;
  downloaded: number;
  uploaded: number;
  relevance: number;
  files: string;
}

export interface TorrentFile {
  index: number;
  name: string;
  size: number;
  progress: number;
  priority: number;
  availability: number;
}

export interface TorrentDetails {
  properties: TorrentProperties;
  trackers: TorrentTracker[];
  peers: TorrentPeer[];
  webSeeds: string[];
  files: TorrentFile[];
}

export type TorrentDetailsSection = "properties" | "trackers" | "peers" | "webSeeds" | "files";

export type PartialTorrentDetails = Partial<TorrentDetails>;

export type SortField =
  | "priority"
  | "name"
  | "size"
  | "progress"
  | "dlspeed"
  | "upspeed"
  | "ratio"
  | "eta"
  | "num_seeds"
  | "num_leechs"
  | "category"
  | "state"
  | "added_on";

export type SortDirection = "asc" | "desc";
