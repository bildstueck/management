"use client";

import { useActionState, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createWorkspaceAction,
  type CreateWorkspaceState,
} from "@/app/(app)/dashboard/actions";

export function CreateWorkspaceDialog() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<CreateWorkspaceState, FormData>(
    createWorkspaceAction,
    undefined,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>Neuen Workspace anlegen</DialogTrigger>
      <DialogContent>
        <form action={action}>
          <DialogHeader>
            <DialogTitle>Neuer Workspace</DialogTitle>
            <DialogDescription>
              Ein Workspace bündelt die Social-Accounts und Beiträge eines Kunden/einer Marke.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-4">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" placeholder="z. B. Kunde GmbH" required autoFocus />
            {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Wird angelegt…" : "Anlegen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
