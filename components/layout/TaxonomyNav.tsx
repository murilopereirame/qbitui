"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Folder, FolderOpen, Pencil, Plus, Tag, Tags, Trash2 } from "lucide-react";
import { cn, parseTorrentTags } from "@/lib/utils";
import { TaxonomyFilter } from "@/lib/types";
import { useUIStore } from "@/store";
import { useTorrents } from "@/hooks/useTorrents";
import { useCategories, useCategoryMutations, useTagMutations, useTags } from "@/hooks/useTaxonomy";
import { CategoryDialog, ConfirmDialog, TagDialog } from "@/components/torrents/TaxonomyDialogs";
import { toast } from "sonner";

/** An entry in the categories or tags list, plus how many torrents it holds. */
interface Entry {
  /** null = "everything", "" = "has none", otherwise the category/tag name. */
  value: TaxonomyFilter;
  label: string;
  count: number;
}

export function TaxonomyNav() {
  return (
    <div className="space-y-0.5">
      <CategorySection />
      <TagSection />
    </div>
  );
}

function CategorySection() {
  const router = useRouter();
  const { data: torrents } = useTorrents();
  const { data: categories } = useCategories();
  const { categoryFilter, setCategoryFilter } = useUIStore();
  const { removeCategories } = useCategoryMutations();

  const [open, setOpen] = useState(true);
  const [dialog, setDialog] = useState<{ mode: "create" | "edit"; name: string; savePath: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const entries = useMemo<Entry[]>(() => {
    const all = torrents ?? [];
    const counts = new Map<string, number>();
    for (const torrent of all) {
      const name = torrent.category ?? "";
      if (!name) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    // Categories that exist in qBittorrent but hold nothing still belong in the list.
    for (const name of Object.keys(categories ?? {})) {
      if (!counts.has(name)) counts.set(name, 0);
    }

    return [
      { value: null, label: "All categories", count: all.length },
      { value: "", label: "Uncategorized", count: all.filter((t) => !t.category).length },
      ...[...counts.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, count]) => ({ value: name, label: name, count })),
    ];
  }, [torrents, categories]);

  function handleDelete(name: string) {
    removeCategories.mutate([name], {
      onSuccess: () => {
        toast.success(`Removed category "${name}"`);
        if (categoryFilter === name) setCategoryFilter(null);
        setPendingDelete(null);
      },
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Failed to remove category");
        setPendingDelete(null);
      },
    });
  }

  return (
    <>
      <SectionHeader
        label="Categories"
        icon={<Folder className="h-3.5 w-3.5" />}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        onAdd={() => setDialog({ mode: "create", name: "", savePath: "" })}
        addLabel="New category"
      />

      {open &&
        entries.map((entry) => (
          <TaxonomyRow
            key={entry.value ?? "__all__"}
            entry={entry}
            active={categoryFilter === entry.value}
            icon={
              entry.value === null ? (
                <FolderOpen className="h-4 w-4" />
              ) : (
                <Folder className="h-4 w-4" />
              )
            }
            onSelect={() => {
              router.push("/dashboard");
              setCategoryFilter(entry.value);
            }}
            onEdit={
              entry.value
                ? () =>
                    setDialog({
                      mode: "edit",
                      name: entry.value as string,
                      savePath: categories?.[entry.value as string]?.savePath ?? "",
                    })
                : undefined
            }
            onDelete={entry.value ? () => setPendingDelete(entry.value as string) : undefined}
          />
        ))}

      <CategoryDialog
        open={dialog !== null}
        mode={dialog?.mode ?? "create"}
        initialName={dialog?.name ?? ""}
        initialSavePath={dialog?.savePath ?? ""}
        onClose={() => setDialog(null)}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Remove category"
        description={`Remove "${pendingDelete}"? Torrents in it stay, but lose the category.`}
        confirmLabel="Remove"
        pending={removeCategories.isPending}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && handleDelete(pendingDelete)}
      />
    </>
  );
}

function TagSection() {
  const router = useRouter();
  const { data: torrents } = useTorrents();
  const { data: tags } = useTags();
  const { tagFilter, setTagFilter } = useUIStore();
  const { deleteTags } = useTagMutations();

  const [open, setOpen] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const entries = useMemo<Entry[]>(() => {
    const all = torrents ?? [];
    const counts = new Map<string, number>();
    let untagged = 0;
    for (const torrent of all) {
      const torrentTags = parseTorrentTags(torrent.tags);
      if (torrentTags.length === 0) untagged += 1;
      for (const tag of torrentTags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    for (const tag of tags ?? []) {
      if (!counts.has(tag)) counts.set(tag, 0);
    }

    return [
      { value: null, label: "All tags", count: all.length },
      { value: "", label: "Untagged", count: untagged },
      ...[...counts.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, count]) => ({ value: name, label: name, count })),
    ];
  }, [torrents, tags]);

  function handleDelete(tag: string) {
    deleteTags.mutate([tag], {
      onSuccess: () => {
        toast.success(`Deleted tag "${tag}"`);
        if (tagFilter === tag) setTagFilter(null);
        setPendingDelete(null);
      },
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Failed to delete tag");
        setPendingDelete(null);
      },
    });
  }

  return (
    <>
      <SectionHeader
        label="Tags"
        icon={<Tags className="h-3.5 w-3.5" />}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        onAdd={() => setDialogOpen(true)}
        addLabel="New tag"
      />

      {open &&
        entries.map((entry) => (
          <TaxonomyRow
            key={entry.value ?? "__all__"}
            entry={entry}
            active={tagFilter === entry.value}
            icon={entry.value === null ? <Tags className="h-4 w-4" /> : <Tag className="h-4 w-4" />}
            onSelect={() => {
              router.push("/dashboard");
              setTagFilter(entry.value);
            }}
            onDelete={entry.value ? () => setPendingDelete(entry.value as string) : undefined}
          />
        ))}

      <TagDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete tag"
        description={`Delete "${pendingDelete}"? Torrents carrying it stay, but lose the tag.`}
        pending={deleteTags.isPending}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && handleDelete(pendingDelete)}
      />
    </>
  );
}

function SectionHeader({
  label,
  icon,
  open,
  onToggle,
  onAdd,
  addLabel,
}: {
  label: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  onAdd: () => void;
  addLabel: string;
}) {
  return (
    <div className="flex items-center gap-1 pt-3 pb-1 pl-2 pr-1">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="flex flex-1 items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-fg-subtle hover:text-foreground transition-colors cursor-pointer"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {icon}
        {label}
      </button>
      <button
        onClick={onAdd}
        title={addLabel}
        aria-label={addLabel}
        className="p-1 rounded text-fg-subtle hover:text-foreground hover:bg-hover transition-colors cursor-pointer"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function TaxonomyRow({
  entry,
  active,
  icon,
  onSelect,
  onEdit,
  onDelete,
}: {
  entry: Entry;
  active: boolean;
  icon: React.ReactNode;
  onSelect: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-center rounded-lg pr-1 transition-colors",
        active ? "bg-blue-600/20" : "hover:bg-hover"
      )}
    >
      <button
        onClick={onSelect}
        className={cn(
          "flex flex-1 min-w-0 items-center gap-2 px-3 py-1.5 text-sm cursor-pointer",
          active ? "text-accent" : "text-fg-muted hover:text-foreground"
        )}
      >
        <span className="shrink-0">{icon}</span>
        <span className="truncate">{entry.label}</span>
        <span
          className={cn(
            "ml-auto text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center shrink-0",
            active ? "bg-blue-600/30 text-accent" : "bg-raise-strong text-fg-muted"
          )}
        >
          {entry.count}
        </span>
      </button>

      {(onEdit || onDelete) && (
        <div className="flex items-center opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          {onEdit && (
            <button
              onClick={onEdit}
              title={`Edit ${entry.label}`}
              aria-label={`Edit ${entry.label}`}
              className="p-1 rounded text-fg-subtle hover:text-foreground cursor-pointer"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              title={`Delete ${entry.label}`}
              aria-label={`Delete ${entry.label}`}
              className="p-1 rounded text-fg-subtle hover:text-negative cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
