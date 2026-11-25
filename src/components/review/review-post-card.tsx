"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MessageSquare, ChevronDown, ChevronUp, CheckCircle2, XCircle } from "lucide-react";
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
import { ContentPreview } from "@/components/previews/content-preview";
import type { PreviewMedia } from "@/components/previews/types";
import { ReviewComments, type ReviewCommentItem } from "@/components/review/review-comments";
import { relativeTime } from "@/lib/relative-time";
import {
  approveReviewPostAction,
  rejectReviewPostAction,
  editReviewPostTextAction,
} from "@/app/review/[token]/actions";

const STATUS_LABELS: Record<PostStatus, string> = {
  DRAFT: "Entwurf",
  PENDING_APPROVAL: "Wartet auf deine Freigabe",
  APPROVED: "Freigegeben",
  SCHEDULED: "Geplant",
  PUBLISHED: "Veröffentlicht",
  FAILED: "Fehlgeschlagen",
};

const STATUS_VARIANTS: Record<PostStatus, "default" | "secondary" | "destructive"> = {
  DRAFT: "secondary",
  PENDING_APPROVAL: "secondary",
  APPROVED: "default",
  SCHEDULED: "default",
  PUBLISHED: "default",
  FAILED: "destructive",
};

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

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
  masterMedia,
  scheduledAt,
  channels,
  comments,
  history,
  canApprove,
  canEdit,
  canComment,
  reviewerName,
  compact = false,
  approvedAt,
  rejectedAt,
  rejectionNote,
}: {
  token: string;
  postId: string;
  status: PostStatus;
  masterText: string;
  masterMedia: PreviewMedia[];
  scheduledAt: Date | null;
  channels: Channel[];
  comments: ReviewCommentItem[];
  history: HistoryEvent[];
  canApprove: boolean;
  canEdit: boolean;
  canComment: boolean;
  reviewerName: string;
  // Compact mode skips the media preview / channel tabs for an
  // already-decided post — used in the "Bereits freigegeben / abgelehnt"
  // list, where a full image card per row felt cluttered. approvedAt
  // (post.updatedAt at approval time) or rejectedAt (the rejection event's
  // createdAt) drives the checkmark/cross + relative time there.
  compact?: boolean;
  approvedAt?: Date | null;
  rejectedAt?: Date | null;
  rejectionNote?: string | null;
}) {
  const [currentStatus, setCurrentStatus] = useState(status);
  const [editing, setEditing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [text, setText] = useState(masterText);
  const [rejectReason, setRejectReason] = useState("");
  const [name, setName] = useState(reviewerName);
  const [showHistory, setShowHistory] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [channelsOpen, setChannelsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(comments.length);
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

  function reject() {
    startTransition(async () => {
      try {
        await rejectReviewPostAction(token, postId, name, rejectReason);
        setCurrentStatus("DRAFT");
        setRejecting(false);
        setRejectReason("");
        toast.success("Beitrag abgelehnt — die Agentur wurde informiert.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Ablehnen fehlgeschlagen.");
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

  const pending = currentStatus === "PENDING_APPROVAL";
  const showComment = canComment || commentCount > 0;

  return (
    <Card
      id={`post-${postId}`}
      className={
        compact
          ? "scroll-mt-20 gap-3 rounded-xl py-4 shadow-sm"
          : "scroll-mt-20 gap-2.5 overflow-hidden rounded-2xl py-0 shadow-sm"
      }
    >
      <CardContent className={compact ? "flex flex-col gap-3 px-4" : "flex flex-col gap-2.5 p-0"}>
        <div className={`flex flex-wrap items-center justify-between gap-2 ${compact ? "" : "px-4 pt-4"}`}>
          <div className="flex items-center gap-2">
            {approvedAt ? (
              <span className="flex items-center gap-1 text-xs font-medium text-primary">
                <CheckCircle2 className="size-3.5" />
                Freigegeben {relativeTime(approvedAt)}
              </span>
            ) : rejectedAt ? (
              <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
                <XCircle className="size-3.5" />
                Abgelehnt {relativeTime(rejectedAt)}
              </span>
            ) : (
              <Badge variant={STATUS_VARIANTS[currentStatus]}>{STATUS_LABELS[currentStatus]}</Badge>
            )}
            {scheduledAt && (
              <span className="text-xs text-muted-foreground">
                geplant für {dateFormatter.format(scheduledAt)}
              </span>
            )}
          </div>
          {!rejecting && (
            <div className="flex gap-2">
              {showComment && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setCommentsOpen((v) => !v)}
                >
                  <MessageSquare className="size-3.5" />
                  {commentCount > 0 ? `Kommentare (${commentCount})` : "Kommentieren"}
                </Button>
              )}
              {canApprove && pending && (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => setRejecting(true)}
                  >
                    Ablehnen
                  </Button>
                  <Button type="button" size="sm" disabled={isPending} onClick={approve}>
                    Freigeben
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {canApprove && pending && rejecting && (
          <div className={`flex flex-col gap-2 rounded-lg border bg-muted/40 p-3 ${compact ? "" : "mx-4"}`}>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Was soll geändert werden? (optional)"
              rows={2}
            />
            <div className="flex gap-2">
              <Button type="button" size="sm" disabled={isPending} onClick={reject}>
                Ablehnung senden
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setRejecting(false)}
              >
                Abbrechen
              </Button>
            </div>
          </div>
        )}

        {compact ? (
          <div>
            <p className="line-clamp-2 text-sm">
              {masterText || <span className="text-muted-foreground italic">(kein Text)</span>}
            </p>
            {rejectionNote && (
              <p className="mt-1 text-xs text-amber-600">
                {rejectionNote.replace(/^Abgelehnt:\s*/, "")}
              </p>
            )}
          </div>
        ) : (
          <div className="px-4">
            <ContentPreview text={masterText} media={masterMedia} compact />
          </div>
        )}

        {!compact && channels.length > 0 && (
          <div className="px-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-ml-2.5 text-muted-foreground"
              onClick={() => setChannelsOpen((v) => !v)}
            >
              {channelsOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              Vorschau pro Kanal
            </Button>
            {channelsOpen && (
              <Tabs defaultValue={channels[0].id} className="mt-1">
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
                    <TabsContent key={channel.id} value={channel.id} className="pt-3">
                      {channel.platform === "FACEBOOK" && <FacebookPreview {...props} />}
                      {channel.platform === "INSTAGRAM" && <InstagramPreview {...props} />}
                      {channel.platform === "LINKEDIN" && <LinkedInPreview {...props} />}
                    </TabsContent>
                  );
                })}
              </Tabs>
            )}
          </div>
        )}

        {!compact && canEdit && (
          <div className="flex flex-col gap-2 px-4">
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

        <div className={compact ? "" : "px-4 pb-4"}>
          <ReviewComments
            open={commentsOpen}
            token={token}
            postId={postId}
            canComment={canComment}
            reviewerName={name}
            initialComments={comments}
            onCommentsChange={(next) => setCommentCount(next.length)}
          />

          {history.length > 0 && (
            <div className="mt-2">
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
        </div>
      </CardContent>
    </Card>
  );
}
