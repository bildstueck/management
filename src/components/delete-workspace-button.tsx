"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteWorkspaceAction } from "@/app/(app)/w/[slug]/settings/actions";

export function DeleteWorkspaceButton({ slug, name }: { slug: string; name: string }) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    const confirmed = window.confirm(
      `"${name}" wirklich endgültig löschen? Alle Beiträge, Medien und Freigabe-Links in diesem Workspace gehen unwiderruflich verloren.`,
    );
    if (!confirmed) return;

    startTransition(async () => {
      try {
        await deleteWorkspaceAction(slug);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Löschen fehlgeschlagen.");
      }
    });
  }

  return (
    <Button type="button" variant="destructive" disabled={isPending} onClick={handleDelete}>
      <Trash2 className="size-4" />
      {isPending ? "Wird gelöscht…" : "Workspace endgültig löschen"}
    </Button>
  );
}
