"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { updateWorkspaceColorAction } from "@/app/(app)/w/[slug]/settings/actions";

const PALETTE = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#64748b",
];

export function WorkspaceColorPicker({ slug, color }: { slug: string; color: string }) {
  const [current, setCurrent] = useState(color);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function pick(next: string) {
    setCurrent(next);
    startTransition(async () => {
      try {
        await updateWorkspaceColorAction(slug, next);
        router.refresh();
      } catch (error) {
        setCurrent(color);
        toast.error(error instanceof Error ? error.message : "Farbe konnte nicht gesetzt werden.");
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {PALETTE.map((swatch) => (
        <button
          key={swatch}
          type="button"
          disabled={isPending}
          onClick={() => pick(swatch)}
          aria-label={`Farbe ${swatch}`}
          className="flex size-7 items-center justify-center rounded-full ring-offset-2 transition-transform hover:scale-110 disabled:opacity-60"
          style={{ backgroundColor: swatch, boxShadow: current === swatch ? `0 0 0 2px var(--background), 0 0 0 4px ${swatch}` : undefined }}
        >
          {current === swatch && <Check className="size-3.5 text-white" />}
        </button>
      ))}
    </div>
  );
}
