"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addMemberAction, type MemberActionState } from "@/app/(app)/w/[slug]/members/actions";

export function AddMemberForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState<MemberActionState, FormData>(
    addMemberAction,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <input type="hidden" name="slug" value={slug} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">E-Mail (bestehender Team-Account)</Label>
        <Input id="email" name="email" type="email" required className="sm:w-64" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="role">Rolle</Label>
        <select
          id="role"
          name="role"
          defaultValue="EDITOR"
          className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
        >
          <option value="EDITOR">Editor</option>
          <option value="OWNER">Owner</option>
        </select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Wird hinzugefügt…" : "Hinzufügen"}
      </Button>
      {state?.error && <p className="text-sm text-destructive sm:ml-2">{state.error}</p>}
    </form>
  );
}
