"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateWorkspaceNameAction } from "@/app/(app)/w/[slug]/settings/actions";

export function WorkspaceNameForm({ slug, name }: { slug: string; name: string }) {
  const [value, setValue] = useState(name);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function save() {
    startTransition(async () => {
      try {
        await updateWorkspaceNameAction(slug, value);
        router.refresh();
        toast.success("Name gespeichert.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="max-w-xs"
        placeholder="Workspace-Name"
      />
      <Button type="button" size="sm" disabled={isPending || !value.trim()} onClick={save}>
        {isPending ? "Wird gespeichert…" : "Speichern"}
      </Button>
    </div>
  );
}
