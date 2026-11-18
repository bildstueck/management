"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import type { MediaType } from "@prisma/client";
import { relativeTime } from "@/lib/relative-time";

type MediaItem = { id: string; url: string; type: MediaType; createdAt: Date };

// Shared by the admin "Material" page and the client-facing one — a grid of
// everything uploaded to the workspace, newest first, with an optional
// delete action per item (omit onDelete for a read-only view).
export function MediaLibraryList({
  media,
  onDelete,
}: {
  media: MediaItem[];
  onDelete?: (mediaId: string) => Promise<void>;
}) {
  const [items, setItems] = useState(media);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!onDelete) return;
    setDeletingId(id);
    try {
      await onDelete(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Löschen fehlgeschlagen.");
    } finally {
      setDeletingId(null);
    }
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Noch nichts hochgeladen.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((item) => (
        <div key={item.id} className="overflow-hidden rounded-lg border bg-background">
          <div className="relative aspect-square bg-black/5">
            {item.type === "VIDEO" ? (
              <video src={item.url} className="h-full w-full object-cover" muted />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.url} alt="" className="h-full w-full object-cover" />
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => handleDelete(item.id)}
                disabled={deletingId === item.id}
                aria-label="Löschen"
                title="Löschen"
                className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-destructive disabled:opacity-60"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
          <p className="px-2 py-1.5 text-xs text-muted-foreground">{relativeTime(item.createdAt)}</p>
        </div>
      ))}
    </div>
  );
}
