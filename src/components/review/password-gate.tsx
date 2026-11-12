"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { unlockShareLinkAction, type UnlockState } from "@/app/review/[token]/actions";

export function PasswordGate({ token }: { token: string }) {
  const boundAction = unlockShareLinkAction.bind(null, token);
  const [state, formAction, pending] = useActionState<UnlockState, FormData>(
    boundAction,
    undefined,
  );

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Passwort erforderlich</CardTitle>
          <CardDescription>Dieser Link ist passwortgeschützt.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="flex flex-col gap-3">
            <Label htmlFor="password">Passwort</Label>
            <Input id="password" name="password" type="password" required autoFocus />
            {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
            <Button type="submit" disabled={pending}>
              {pending ? "Prüfe…" : "Entsperren"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
