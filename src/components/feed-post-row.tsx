"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Platform, PostStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_META } from "@/components/platform-meta";
import { PostComments, type CommentItem } from "@/components/post-comments";
import { isFutureDate } from "@/lib/calendar-dates";
import {
  deletePostAction,
  submitForApprovalAction,
  revertToDraftAction,
  schedulePostAction,
  publishNowAction,
  cancelScheduleAction,
} from "@/app/(app)/w/[slug]/posts/actions";

const STATUS_LABELS: Record<PostStatus, string> = {
  DRAFT: "Entwurf",
  PENDING_APPROVAL: "Wartet auf Freigabe",
  APPROVED: "Freigegeben",
  SCHEDULED: "Geplant",
  PUBLISHED: "Veröffentlicht",
  FAILED: "Fehlgeschlagen",
};

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export type FeedPostRowData = {
  id: string;
  masterText: string | null;
  status: PostStatus;
  scheduledAt: Date | null;
  channelVariants: { id: string; socialAccount: { platform: Platform } }[];
  comments: CommentItem[];
  latestJobError: string | null;
  rejectionNote: string | null;
};

export function FeedPostRow({ slug, post }: { slug: string; post: FeedPostRowData }) {
  const [status, setStatus] = useState(post.status);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const hasChannels = post.channelVariants.length > 0;

  // Optimistic local status update for instant feedback, then a background
  // router.refresh() to resync with the server (picks up e.g. a new publish
  // error, or removes the row entirely after a delete) — revalidatePosts()
  // inside each action already invalidated the data these actions use.
  function run(action: () => Promise<void>, optimisticStatus?: PostStatus) {
    const previous = status;
    if (optimisticStatus) setStatus(optimisticStatus);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (error) {
        setStatus(previous);
        toast.error(error instanceof Error ? error.message : "Aktion fehlgeschlagen.");
      }
    });
  }

  return (
    <Card className="shadow-none">
      <CardContent className="flex flex-col gap-3 py-3.5">
        <div className="flex items-center justify-between gap-4">
          <Link href={`/w/${slug}/posts/${post.id}`} className="flex-1">
            <p className="line-clamp-2 text-sm">
              {post.masterText || <span className="text-muted-foreground">(kein Text)</span>}
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <Badge
                variant={
                  status === "PUBLISHED"
                    ? "default"
                    : status === "FAILED"
                      ? "destructive"
                      : status === "APPROVED"
                        ? "default"
                        : "secondary"
                }
              >
                {STATUS_LABELS[status]}
              </Badge>
              {post.scheduledAt && (
                <span className="text-xs text-muted-foreground">
                  {dateFormatter.format(post.scheduledAt)}
                </span>
              )}
              <span className="flex items-center gap-1">
                {post.channelVariants.map((variant) => {
                  const Icon = PLATFORM_META[variant.socialAccount.platform].icon;
                  return <Icon key={variant.id} className="size-3.5 text-muted-foreground" />;
                })}
              </span>
            </div>
            {status === "FAILED" && post.latestJobError && (
              <p className="mt-1 text-xs text-destructive">{post.latestJobError}</p>
            )}
            {status === "DRAFT" && post.rejectionNote && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-500">
                Vom Kunden abgelehnt: {post.rejectionNote.replace(/^Abgelehnt:\s*/, "") || "ohne Grund"}
              </p>
            )}
          </Link>
          <div className="flex items-center gap-1">
            {status === "DRAFT" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() =>
                  run(() => submitForApprovalAction(slug, post.id), "PENDING_APPROVAL")
                }
              >
                Zur Freigabe einreichen
              </Button>
            )}
            {(status === "PENDING_APPROVAL" || status === "APPROVED") && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() => run(() => revertToDraftAction(slug, post.id), "DRAFT")}
              >
                Zurück zu Entwurf
              </Button>
            )}
            {hasChannels && (status === "APPROVED" || status === "FAILED") && (
              <>
                {post.scheduledAt && isFutureDate(post.scheduledAt) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => run(() => schedulePostAction(slug, post.id), "SCHEDULED")}
                  >
                    Terminieren
                  </Button>
                )}
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  disabled={isPending}
                  onClick={() => run(() => publishNowAction(slug, post.id), "SCHEDULED")}
                >
                  {status === "FAILED" ? "Erneut versuchen" : "Jetzt veröffentlichen"}
                </Button>
              </>
            )}
            {status === "SCHEDULED" && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() => run(() => cancelScheduleAction(slug, post.id), "APPROVED")}
              >
                Planung abbrechen
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={() => run(() => deletePostAction(slug, post.id))}
            >
              Löschen
            </Button>
          </div>
        </div>
        <PostComments slug={slug} postId={post.id} initialComments={post.comments} />
      </CardContent>
    </Card>
  );
}
