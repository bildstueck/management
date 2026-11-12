"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { Platform, PostStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { PLATFORM_META } from "@/components/platform-meta";
import { FacebookPreview } from "@/components/previews/facebook-preview";
import { InstagramPreview } from "@/components/previews/instagram-preview";
import { LinkedInPreview } from "@/components/previews/linkedin-preview";
import type { PreviewMedia } from "@/components/previews/types";
import { ReviewComments, type ReviewCommentItem } from "@/components/review/review-comments";
import { approveReviewPostAction, editReviewPostTextAction } from "@/app/review/[token]/actions";

const STATUS_LABELS: Record<PostStatus, string> = {
  DRAFT: "Entwurf",
  PENDING_APPROVAL: "Wartet auf Freigabe",
  APPROVED: "Freigegeben",
  SCHEDULED: "Geplant",
  PUBLISHED: "Veröffentlicht",
  FAILED: "Fehlgeschlagen",
};

type Channel = {
  id: string;
  platform: Platform;
  accountName: string;
  avatarUrl: string | null;
  text: string | null;
  media: PreviewMedia[];
};

type HistoryEvent = {
  id: string;
  action: string;
  actorName: string | null;
  actorUser: { name: string | null; email: string } | null;
  note: string | null;
  createdAt: Date;
};

export function ReviewPostCard({
  token,
  postId,
  status,
  masterText,
  channels,
  comments,
  history,
  canApprove,
  canEdit,
  canComment,
  reviewerName,
}: {
  token: string;
  postId: string;
  status: PostStatus;
  masterText: string;
  channels: Channel[];
  comments: ReviewCommentItem[];
  history: HistoryEvent[];
  canApprove: boolean;
  canEdit: boolean;
  canComment: boolean;
  reviewerName: string;
}) {
  const [currentStatus, setCurrentStatus] = useState(status);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(masterText);
  const [name, setName] = useState(reviewerName);
  const [showHistory, setShowHistory] = useState(false);
  const [isPending, startTransition] = useTransition();

  function approve() {
    startTransition(async () => {
      try {
        await approveReviewPostAction(token, postId, name);
        setCurrentStatus("APPROVED");
        toast.success("Beitrag freigegeben.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Freigabe fehlgeschlagen.");
      }
    });
  }

  function saveEdit() {
    startTransition(async () => {
      try {
        await editReviewPostTextAction(token, postId, name, text);
        setEditing(false);
        toast.success("Text gespeichert.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
      }
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-4">
        <div className="flex items-center justify-between">
          <Badge variant={currentStatus === "APPROVED" ? "default" : "secondary"}>
            {STATUS_LABELS[currentStatus]}
          </Badge>
          {canApprove && currentStatus === "PENDING_APPROVAL" && (
            <Button type="button" size="sm" disabled={isPending} onClick={approve}>
              Freigeben
            </Button>
          )}
        </div>

        {channels.length > 0 && (
          <Tabs defaultValue={channels[0].id}>
            <TabsList>
              {channels.map((channel) => (
                <TabsTrigger key={channel.id} value={channel.id}>
                  {PLATFORM_META[channel.platform].label}
                </TabsTrigger>
              ))}
            </TabsList>
            {channels.map((channel) => {
              const props = {
                accountName: channel.accountName,
                avatarUrl: channel.avatarUrl,
                text: channel.text ?? "",
                media: channel.media,
                mode: "mobile" as const,
              };
              return (
                <TabsContent key={channel.id} value={channel.id} className="pt-4">
                  {channel.platform === "FACEBOOK" && <FacebookPreview {...props} />}
                  {channel.platform === "INSTAGRAM" && <InstagramPreview {...props} />}
                  {channel.platform === "LINKEDIN" && <LinkedInPreview {...props} />}
                </TabsContent>
              );
            })}
          </Tabs>
        )}

        {canEdit && (
          <div className="flex flex-col gap-2">
            {editing ? (
              <>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Dein Name" />
                <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} />
                <p className="text-xs text-muted-foreground">
                  Ändert den Haupttext. Kanäle mit eigenem, angepasstem Text sind davon nicht
                  betroffen.
                </p>
                <div className="flex gap-2">
                  <Button type="button" size="sm" disabled={isPending} onClick={saveEdit}>
                    Speichern
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
                    Abbrechen
                  </Button>
                </div>
              </>
            ) : (
              <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
                Text bearbeiten
              </Button>
            )}
          </div>
        )}

        <ReviewComments
          token={token}
          postId={postId}
          canComment={canComment}
          reviewerName={name}
          initialComments={comments}
        />

        {history.length > 0 && (
          <div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowHistory((v) => !v)}>
              Verlauf ({history.length})
            </Button>
            {showHistory && (
              <ul className="mt-1 flex flex-col gap-1 text-xs text-muted-foreground">
                {history.map((event) => (
                  <li key={event.id} className="whitespace-pre-wrap">
                    {new Date(event.createdAt).toLocaleString("de-DE")} —{" "}
                    {event.actorUser?.name ?? event.actorUser?.email ?? event.actorName ?? "System"}:{" "}
                    {event.note ?? event.action}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
