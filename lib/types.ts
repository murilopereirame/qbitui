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

export type TorrentAction = "pause" | "resume" | "delete" | "recheck" | "reannounce";

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

export type SortField =
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
