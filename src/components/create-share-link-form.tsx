"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  createShareLinkAction,
  type CreateShareLinkState,
} from "@/app/(app)/w/[slug]/share/actions";

export function CreateShareLinkForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState<CreateShareLinkState, FormData>(
    createShareLinkAction,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="slug" value={slug} />

      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Passwort (optional)</Label>
          <Input id="password" name="password" type="text" placeholder="leer = kein Passwort" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="expiresInDays">Läuft ab nach (Tage, optional)</Label>
          <Input
            id="expiresInDays"
            name="expiresInDays"
            type="number"
            min={1}
            placeholder="leer = läuft nie ab"
            className="w-40"
          />
        </div>
      </div>

      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="canComment" defaultChecked /> Kommentieren erlauben
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="canApprove" defaultChecked /> Freigeben erlauben
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="canEdit" /> Text bearbeiten erlauben
        </label>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Wird erstellt…" : "Link erstellen"}
      </Button>
    </form>
  );
}
