"use client";

import { Check, Video } from "lucide-react";
import { cn } from "@/lib/utils";

export type MediaOption = { id: string; type: "IMAGE" | "VIDEO"; url: string };

export function MediaPickerGrid({
  media,
  selectedIds,
  onToggle,
}: {
  media: MediaOption[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  if (media.length === 0) {
    return <p className="text-sm text-muted-foreground">Noch keine Medien hochgeladen.</p>;
  }

  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
      {media.map((item) => {
        const selected = selectedIds.includes(item.id);
        const order = selectedIds.indexOf(item.id);
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onToggle(item.id)}
            className={cn(
              "relative aspect-square overflow-hidden rounded-md border-2",
              selected ? "border-primary" : "border-transparent",
            )}
          >
            {item.type === "VIDEO" ? (
              <div className="flex h-full w-full items-center justify-center bg-muted">
                <Video className="size-6 text-muted-foreground" />
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.url} alt="" className="h-full w-full object-cover" />
            )}
            {selected && (
              <span className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                {order + 1}
              </span>
            )}
            {!selected && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity hover:bg-black/20 hover:opacity-100">
                <Check className="size-5 text-white" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
