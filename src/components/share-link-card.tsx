"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/copy-button";
import { deleteShareLinkAction } from "@/app/(app)/w/[slug]/share/actions";

type ShareLinkData = {
  id: string;
  url: string;
  recipientName: string | null;
  passwordHash: string | null;
  expiresAt: Date | null;
  canComment: boolean;
  canApprove: boolean;
  canEdit: boolean;
  canUpload: boolean;
};

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function ShareLinkCard({ slug, link }: { slug: string; link: ShareLinkData }) {
  const [deleted, setDeleted] = useState(false);
  const [isPending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      try {
        await deleteShareLinkAction(slug, link.id);
        setDeleted(true);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Löschen fehlgeschlagen.");
      }
    });
  }

  if (deleted) return null;

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 py-4">
        <div>
          {link.recipientName && <p className="text-sm font-semibold">{link.recipientName}</p>}
          <p className="font-mono text-sm text-muted-foreground">{link.url}</p>
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            {link.passwordHash && <Badge variant="secondary">Passwortgeschützt</Badge>}
            {link.expiresAt && (
              <Badge variant="secondary">Läuft ab: {dateFormatter.format(link.expiresAt)}</Badge>
            )}
            {link.canComment && <Badge variant="secondary">Kommentare</Badge>}
            {link.canApprove && <Badge variant="secondary">Freigabe</Badge>}
            {link.canEdit && <Badge variant="secondary">Bearbeiten</Badge>}
            {link.canUpload && <Badge variant="secondary">Medien-Upload</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CopyButton value={link.url} />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={isPending}
            onClick={remove}
            aria-label="Link löschen"
            title="Link löschen"
          >
            <X className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
