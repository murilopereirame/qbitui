"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCategoryMutations, useTagMutations } from "@/hooks/useTaxonomy";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CategoryDialogProps {
  open: boolean;
  /** Editing only changes the save path — qBittorrent cannot rename a category. */
  mode: "create" | "edit";
  initialName?: string;
  initialSavePath?: string;
  onClose: () => void;
  /** Called with the category name once qBittorrent accepted it. */
  onSaved?: (name: string) => void;
}

/**
 * The form lives in its own component so that opening the dialog mounts it
 * afresh — the fields then start from the current props with no reset effect.
 */
export function CategoryDialog({ open, onClose, ...rest }: CategoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      {open && <CategoryForm open={open} onClose={onClose} {...rest} />}
    </Dialog>
  );
}

function CategoryForm({
  mode,
  initialName = "",
  initialSavePath = "",
  onClose,
  onSaved,
}: CategoryDialogProps) {
  const { createCategory, editCategory } = useCategoryMutations();
  const [name, setName] = useState(initialName);
  const [savePath, setSavePath] = useState(initialSavePath);

  const mutation = mode === "create" ? createCategory : editCategory;
  const isEdit = mode === "edit";

  function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    mutation.mutate(
      { name: trimmed, savePath: savePath.trim() },
      {
        onSuccess: () => {
          toast.success(isEdit ? `Updated category "${trimmed}"` : `Created category "${trimmed}"`);
          onSaved?.(trimmed);
          onClose();
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to save category"),
      }
    );
  }

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit Category" : "New Category"}</DialogTitle>
        <DialogDescription>
          {isEdit
            ? "Change where torrents in this category are saved."
            : "Categories group torrents and can set a default save path."}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="category-name">Name</Label>
          <Input
            id="category-name"
            autoFocus={!isEdit}
            disabled={isEdit}
            placeholder="movies"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="category-path">Save path (optional)</Label>
          <Input
            id="category-path"
            autoFocus={isEdit}
            placeholder="/downloads/movies"
            value={savePath}
            onChange={(e) => setSavePath(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={!name.trim() || mutation.isPending}>
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEdit ? "Save" : "Create"}
        </Button>
      </div>
    </DialogContent>
  );
}

interface TagDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called with the created tag names once qBittorrent accepted them. */
  onCreated?: (tags: string[]) => void;
}

export function TagDialog({ open, onClose, onCreated }: TagDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      {open && <TagForm open={open} onClose={onClose} onCreated={onCreated} />}
    </Dialog>
  );
}

function TagForm({ onClose, onCreated }: TagDialogProps) {
  const { createTags } = useTagMutations();
  const [value, setValue] = useState("");

  // Tag names travel comma-separated, so a comma always starts a new tag.
  const tags = value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  function handleSubmit() {
    if (tags.length === 0) return;
    createTags.mutate(tags, {
      onSuccess: () => {
        toast.success(tags.length > 1 ? `Created ${tags.length} tags` : `Created tag "${tags[0]}"`);
        onCreated?.(tags);
        onClose();
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to create tag"),
    });
  }

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>New Tag</DialogTitle>
        <DialogDescription>Tags label torrents freely — a torrent can carry several.</DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <Label htmlFor="tag-name">Name</Label>
        <Input
          id="tag-name"
          autoFocus
          placeholder="hd, archive"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />
        <p className="text-xs text-fg-subtle">Separate several tags with commas.</p>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={tags.length === 0 || createTags.isPending}>
          {createTags.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create
        </Button>
      </div>
    </DialogContent>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  pending?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Delete",
  pending = false,
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
