"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const PREF_KEY = "qbitui_delete_files";

function loadPref(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) === "true";
  } catch {
    return false;
  }
}

function savePref(value: boolean): void {
  try {
    localStorage.setItem(PREF_KEY, String(value));
  } catch {}
}

interface Props {
  open: boolean;
  torrentCount: number;
  torrentName?: string;
  onClose: () => void;
  onConfirm: (deleteFiles: boolean) => void;
}

export function DeleteConfirmationDialog({
  open,
  torrentCount,
  torrentName,
  onClose,
  onConfirm,
}: Props) {
  const [deleteFiles, setDeleteFiles] = useState(false);

  useEffect(() => {
    if (open) {
      setDeleteFiles(loadPref());
    }
  }, [open]);

  function handleConfirm() {
    savePref(deleteFiles);
    onConfirm(deleteFiles);
  }

  const isBulk = torrentCount > 1;
  const description = isBulk
    ? `Remove ${torrentCount} torrents?`
    : `Remove "${torrentName}"?`;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Torrent{isBulk ? "s" : ""}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 py-2">
          <Checkbox
            id="delete-files"
            checked={deleteFiles}
            onCheckedChange={(v) => setDeleteFiles(Boolean(v))}
          />
          <Label htmlFor="delete-files" className="cursor-pointer text-sm text-foreground">
            Also delete downloaded files
          </Label>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm}>
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
