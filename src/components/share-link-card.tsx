"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { X, Pencil, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { CopyButton } from "@/components/copy-button";
import {
  deleteShareLinkAction,
  updateShareLinkAction,
} from "@/app/(app)/w/[slug]/share/actions";

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

const PERMISSION_FIELDS = [
  { key: "canComment", label: "Kommentieren" },
  { key: "canApprove", label: "Freigeben" },
  { key: "canEdit", label: "Text bearbeiten" },
  { key: "canUpload", label: "Medien hochladen" },
] as const;

export function ShareLinkCard({ slug, link }: { slug: string; link: ShareLinkData }) {
  const [current, setCurrent] = useState(link);
  const [deleted, setDeleted] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(link.recipientName ?? "");
  const [isPending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      try {
        await deleteShareLinkAction(slug, current.id);
        setDeleted(true);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Löschen fehlgeschlagen.");
      }
    });
  }

  function togglePermission(key: (typeof PERMISSION_FIELDS)[number]["key"]) {
    const next = !current[key];
    setCurrent((prev) => ({ ...prev, [key]: next }));
    startTransition(async () => {
      try {
        await updateShareLinkAction(slug, current.id, { [key]: next });
      } catch (error) {
        setCurrent((prev) => ({ ...prev, [key]: !next }));
        toast.error(error instanceof Error ? error.message : "Ändern fehlgeschlagen.");
      }
    });
  }

  function saveName() {
    const trimmed = nameDraft.trim();
    const previous = current.recipientName;
    setCurrent((prev) => ({ ...prev, recipientName: trimmed || null }));
    setEditingName(false);
    startTransition(async () => {
      try {
        await updateShareLinkAction(slug, current.id, { recipientName: trimmed || null });
      } catch (error) {
        setCurrent((prev) => ({ ...prev, recipientName: previous }));
        toast.error(error instanceof Error ? error.message : "Ändern fehlgeschlagen.");
      }
    });
  }

  if (deleted) return null;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {editingName ? (
              <div className="flex items-center gap-2">
                <Input
                  autoFocus
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveName()}
                  placeholder="z. B. Familie Ebert"
                  className="h-8 max-w-xs"
                />
                <Button type="button" size="icon-sm" onClick={saveName}>
                  <Check className="size-4" />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setEditingName(true)}
                className="group flex items-center gap-1.5 text-sm font-semibold hover:text-primary"
              >
                {current.recipientName || (
                  <span className="text-muted-foreground italic">Ohne Namen</span>
                )}
                <Pencil className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
              </button>
            )}
            <p className="mt-1 truncate font-mono text-sm text-muted-foreground">{current.url}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <CopyButton value={current.url} />
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
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {PERMISSION_FIELDS.map((field) => (
            <label key={field.key} className="flex items-center gap-1.5 text-xs">
              <Checkbox
                checked={current[field.key]}
                onCheckedChange={() => togglePermission(field.key)}
              />
              {field.label}
            </label>
          ))}
          {current.passwordHash && <Badge variant="secondary">Passwortgeschützt</Badge>}
          {current.expiresAt && (
            <Badge variant="secondary">Läuft ab: {dateFormatter.format(current.expiresAt)}</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
