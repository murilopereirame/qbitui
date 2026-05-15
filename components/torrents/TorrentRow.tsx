"use client";

import { Torrent } from "@/lib/types";
import {
  formatBytes,
  formatSpeed,
  formatETA,
  formatRatio,
  getStateLabel,
  getStateColor,
  cn,
} from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Play, Pause, Trash2, RefreshCw, Radio } from "lucide-react";
import { useTorrentAction } from "@/hooks/useTorrents";
import { useUIStore } from "@/store";
import { toast } from "sonner";

interface TorrentRowProps {
  torrent: Torrent;
}

export function TorrentRow({ torrent }: TorrentRowProps) {
  const { selectedHashes, toggleSelection } = useUIStore();
  const { mutate: action } = useTorrentAction();
  const isSelected = selectedHashes.has(torrent.hash);

  function doAction(act: Parameters<typeof action>[0]["action"], deleteFiles?: boolean) {
    action(
      { action: act, hashes: [torrent.hash], deleteFiles },
      {
        onError: (e) => toast.error(e instanceof Error ? e.message : "Action failed"),
      }
    );
  }

  const isPaused = torrent.state === "pausedDL" || torrent.state === "pausedUP";

  return (
    <tr
      className={cn(
        "group border-b border-white/5 hover:bg-white/3 transition-colors",
        isSelected && "bg-blue-600/10"
      )}
    >
      {/* Checkbox */}
      <td className="pl-3 pr-1 py-2 w-8">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => toggleSelection(torrent.hash)}
        />
      </td>

      {/* Name */}
      <td className="px-2 py-2 max-w-0">
        <div className="truncate text-sm text-white font-medium" title={torrent.name}>
          {torrent.name}
        </div>
        <div className="mt-1">
          <Progress value={torrent.progress * 100} className="h-1" />
        </div>
      </td>

      {/* State */}
      <td className="px-2 py-2 whitespace-nowrap">
        <Badge className={cn("text-xs border", getStateColor(torrent.state))}>
          {getStateLabel(torrent.state)}
        </Badge>
      </td>

      {/* Progress % */}
      <td className="px-2 py-2 whitespace-nowrap text-sm text-gray-300 text-right tabular-nums">
        {(torrent.progress * 100).toFixed(1)}%
      </td>

      {/* Size */}
      <td className="px-2 py-2 whitespace-nowrap text-sm text-gray-300 text-right tabular-nums">
        {formatBytes(torrent.size)}
      </td>

      {/* DL Speed */}
      <td className="px-2 py-2 whitespace-nowrap text-sm text-blue-400 text-right tabular-nums">
        {torrent.dlspeed > 0 ? formatSpeed(torrent.dlspeed) : "—"}
      </td>

      {/* UL Speed */}
      <td className="px-2 py-2 whitespace-nowrap text-sm text-green-400 text-right tabular-nums">
        {torrent.upspeed > 0 ? formatSpeed(torrent.upspeed) : "—"}
      </td>

      {/* ETA */}
      <td className="px-2 py-2 whitespace-nowrap text-sm text-gray-300 text-right tabular-nums">
        {formatETA(torrent.eta)}
      </td>

      {/* Ratio */}
      <td className="px-2 py-2 whitespace-nowrap text-sm text-gray-300 text-right tabular-nums">
        {formatRatio(torrent.ratio)}
      </td>

      {/* Seeds/Peers */}
      <td className="px-2 py-2 whitespace-nowrap text-sm text-gray-400 text-right tabular-nums">
        {torrent.num_seeds}/{torrent.num_leechs}
      </td>

      {/* Category */}
      <td className="px-2 py-2 whitespace-nowrap text-sm">
        {torrent.category ? (
          <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs border">
            {torrent.category}
          </Badge>
        ) : (
          <span className="text-gray-600">—</span>
        )}
      </td>

      {/* Actions */}
      <td className="px-2 py-2 w-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10 cursor-pointer">
              <MoreHorizontal className="h-4 w-4 text-gray-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isPaused ? (
              <DropdownMenuItem onClick={() => doAction("resume")}>
                <Play className="mr-2 h-4 w-4 text-green-400" /> Resume
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => doAction("pause")}>
                <Pause className="mr-2 h-4 w-4 text-yellow-400" /> Pause
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => doAction("recheck")}>
              <RefreshCw className="mr-2 h-4 w-4 text-blue-400" /> Recheck
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => doAction("reannounce")}>
              <Radio className="mr-2 h-4 w-4 text-purple-400" /> Reannounce
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => doAction("delete", false)}
              className="text-red-400 focus:text-red-400"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => doAction("delete", true)}
              className="text-red-400 focus:text-red-400"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete + Files
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}
