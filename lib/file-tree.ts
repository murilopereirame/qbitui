import { TorrentMetadataFile } from "./types";

/** A folder or file in the content tree of a torrent that is being added. */
export interface ContentNode {
  /** Full path of this node, unique within the torrent. */
  key: string;
  name: string;
  depth: number;
  isDir: boolean;
  size: number;
  /** Paths of every file at or below this node. */
  filePaths: string[];
  children: ContentNode[];
}

/** Groups a flat file list into a folder tree, folders first then A→Z. */
export function buildContentTree(files: TorrentMetadataFile[]): ContentNode[] {
  const roots: ContentNode[] = [];
  const byKey = new Map<string, ContentNode>();

  for (const file of files) {
    const segments = file.path.split("/").filter(Boolean);
    let siblings = roots;

    segments.forEach((segment, depth) => {
      const key = segments.slice(0, depth + 1).join("/");
      let node = byKey.get(key);
      if (!node) {
        node = {
          key,
          name: segment,
          depth,
          isDir: depth < segments.length - 1,
          size: 0,
          filePaths: [],
          children: [],
        };
        byKey.set(key, node);
        siblings.push(node);
      }
      node.size += file.size;
      node.filePaths.push(file.path);
      siblings = node.children;
    });
  }

  return sortNodes(roots);
}

function sortNodes(nodes: ContentNode[]): ContentNode[] {
  nodes.sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name));
  for (const node of nodes) sortNodes(node.children);
  return nodes;
}

/** Depth-first list of nodes, skipping anything under a collapsed folder. */
export function visibleNodes(nodes: ContentNode[], collapsed: Set<string>): ContentNode[] {
  const result: ContentNode[] = [];
  const walk = (node: ContentNode) => {
    result.push(node);
    if (node.isDir && collapsed.has(node.key)) return;
    node.children.forEach(walk);
  };
  nodes.forEach(walk);
  return result;
}
