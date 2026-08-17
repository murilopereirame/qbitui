"use client";

import { Search, Plus, ArrowDown, ArrowUp, Folder, Tag, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/store";
import { useTransfer } from "@/hooks/useTransfer";
import { formatSpeed } from "@/lib/utils";
import { TaxonomyFilter } from "@/lib/types";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export function TopBar() {
  const { search, setSearch, setAddModalOpen, categoryFilter, setCategoryFilter, tagFilter, setTagFilter } =
    useUIStore();
  const { data: transfer } = useTransfer();

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-line bg-chrome shrink-0">
      {/* Search */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-subtle" />
        <Input
          placeholder="Search torrents…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      {/* Active category / tag filters */}
      <div className="flex items-center gap-2 min-w-0">
        <FilterChip
          icon={<Folder className="h-3 w-3" />}
          value={categoryFilter}
          emptyLabel="Uncategorized"
          onClear={() => setCategoryFilter(null)}
        />
        <FilterChip
          icon={<Tag className="h-3 w-3" />}
          value={tagFilter}
          emptyLabel="Untagged"
          onClear={() => setTagFilter(null)}
        />
      </div>

      {/* Speeds */}
      <div className="hidden sm:flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5 text-accent">
          <ArrowDown className="h-4 w-4" />
          <span className="font-mono">{transfer ? formatSpeed(transfer.dl_info_speed) : "— B/s"}</span>
        </div>
        <div className="flex items-center gap-1.5 text-positive">
          <ArrowUp className="h-4 w-4" />
          <span className="font-mono">{transfer ? formatSpeed(transfer.up_info_speed) : "— B/s"}</span>
        </div>
      </div>

      {/* Theme + add button */}
      <div className="flex items-center gap-2 shrink-0">
        <ThemeToggle />
        <Button onClick={() => setAddModalOpen(true)} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add Torrent
        </Button>
      </div>
    </div>
  );
}

/** Shows the active category/tag filter, if any, with a way to clear it. */
function FilterChip({
  icon,
  value,
  emptyLabel,
  onClear,
}: {
  icon: React.ReactNode;
  /** null when nothing is filtered; "" when filtering on "has none". */
  value: TaxonomyFilter;
  emptyLabel: string;
  onClear: () => void;
}) {
  if (value === null) return null;

  return (
    <span className="flex items-center gap-1.5 rounded-full bg-blue-600/15 pl-2.5 pr-1.5 py-1 text-xs text-accent max-w-40">
      {icon}
      <span className="truncate">{value === "" ? emptyLabel : value}</span>
      <button
        onClick={onClear}
        aria-label="Clear filter"
        title="Clear filter"
        className="rounded-full p-0.5 hover:bg-blue-600/25 transition-colors cursor-pointer"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
