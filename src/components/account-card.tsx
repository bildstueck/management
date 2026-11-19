"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { disconnectAccountAction } from "@/app/(app)/w/[slug]/accounts/actions";

export function AccountCard({
  slug,
  account,
  platformLabel,
  status,
  canManage,
}: {
  slug: string;
  account: { id: string; displayName: string; avatarUrl: string | null };
  platformLabel: string;
  status: { label: string; variant: "secondary" | "destructive" };
  canManage: boolean;
}) {
  const [disconnected, setDisconnected] = useState(false);
  const [isPending, startTransition] = useTransition();

  function disconnect() {
    startTransition(async () => {
      try {
        await disconnectAccountAction(slug, account.id);
        setDisconnected(true);
        toast.success(`${account.displayName} getrennt.`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Trennen fehlgeschlagen.");
      }
    });
  }

  if (disconnected) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3 space-y-0">
        <Avatar>
          <AvatarImage src={account.avatarUrl ?? undefined} />
          <AvatarFallback>{account.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <CardTitle className="text-base">{account.displayName}</CardTitle>
          <CardDescription>{platformLabel}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex items-center justify-between">
        <Badge variant={status.variant}>{status.label}</Badge>
        {canManage && (
          <Button type="button" variant="ghost" size="sm" disabled={isPending} onClick={disconnect}>
            {isPending ? "Wird getrennt…" : "Trennen"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
