import { createHash } from "crypto";
import {
  decodeBencode,
  decodeNumber,
  decodeText,
  isBencodeDict,
  type BencodeDict,
  type BencodeValue,
} from "./bencode";
import { TorrentMetadata, TorrentMetadataFile } from "./types";

/**
 * Reads the file list out of a .torrent file without handing it to
 * qBittorrent, so the user can choose what to download before the torrent is
 * ever queued.
 */
export function parseTorrentMetadata(data: Uint8Array): TorrentMetadata {
  const { value, spans } = decodeBencode(data);
  if (!isBencodeDict(value)) throw new Error("Not a valid .torrent file");

  const info = value.info;
  if (!isBencodeDict(info)) throw new Error("Torrent file has no info dictionary");

  const span = spans.get("info");
  const infoHash = span ? createHash("sha1").update(data.subarray(span[0], span[1])).digest("hex") : null;

  const name = decodeText(info["name.utf-8"]) || decodeText(info.name) || "Unnamed torrent";
  const files = readFiles(info, name);

  return {
    name,
    infoHash,
    files,
    totalSize: files.reduce((total, file) => total + file.size, 0),
    pieceLength: decodeNumber(info["piece length"]),
    private: decodeNumber(info.private) === 1,
    comment: decodeText(value["comment.utf-8"]) || decodeText(value.comment) || undefined,
    createdBy: decodeText(value["created by"]) || undefined,
    creationDate: decodeNumber(value["creation date"]) || undefined,
  };
}

/**
 * Paths are built exactly the way qBittorrent reports them (root folder
 * included for multi-file torrents) so the two lists can be matched up later.
 */
function readFiles(info: BencodeDict, name: string): TorrentMetadataFile[] {
  const list = info["files.utf-8"] ?? info.files;

  if (Array.isArray(list)) {
    return list.flatMap((entry, index) => {
      if (!isBencodeDict(entry)) return [];
      const segments = pathSegments(entry["path.utf-8"] ?? entry.path);
      if (segments.length === 0) return [];
      return [{ index, path: [name, ...segments].join("/"), size: decodeNumber(entry.length) }];
    });
  }

  // BitTorrent v2 stores a nested file tree instead of a flat list.
  const tree = info["file tree"];
  if (isBencodeDict(tree)) {
    const files: TorrentMetadataFile[] = [];
    walkFileTree(tree, [name], files);
    return files.map((file, index) => ({ ...file, index }));
  }

  // Single-file torrent.
  return [{ index: 0, path: name, size: decodeNumber(info.length) }];
}

function pathSegments(value: BencodeValue | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((segment) => decodeText(segment)).filter(Boolean);
}

function walkFileTree(node: BencodeDict, prefix: string[], out: TorrentMetadataFile[]): void {
  for (const [key, child] of Object.entries(node)) {
    if (!isBencodeDict(child)) continue;
    if (key === "") {
      // The empty key holds the file's own properties.
      out.push({ index: out.length, path: prefix.join("/"), size: decodeNumber(child.length) });
      continue;
    }
    walkFileTree(child, [...prefix, key], out);
  }
}

/** Best-effort v1 info hash of a magnet link, used to locate it after adding. */
export function magnetInfoHash(magnet: string): string | null {
  const match = /xt=urn:btih:([a-zA-Z0-9]+)/.exec(magnet);
  if (!match) return null;
  const value = match[1];
  if (/^[0-9a-fA-F]{40}$/.test(value)) return value.toLowerCase();
  if (/^[A-Z2-7]{32}$/i.test(value)) return base32ToHex(value.toUpperCase());
  return null;
}

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32ToHex(value: string): string | null {
  let bits = "";
  for (const char of value) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) return null;
    bits += index.toString(2).padStart(5, "0");
  }
  let hex = "";
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    hex += parseInt(bits.slice(i, i + 8), 2).toString(16).padStart(2, "0");
  }
  return hex.length === 40 ? hex : null;
}
