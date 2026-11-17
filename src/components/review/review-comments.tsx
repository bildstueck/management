"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  addReviewCommentAction,
  toggleReviewCommentResolvedAction,
} from "@/app/review/[token]/actions";

export type ReviewCommentItem = {
  id: string;
  text: string;
  resolved: boolean;
  authorType: "INTERNAL" | "EXTERNAL";
  authorUser: { name: string | null; email: string } | null;
  authorName: string | null;
};

// Open/close state lives in the parent (ReviewPostCard), which puts the
// toggle button in the same row as Freigeben/Ablehnen — comments are a
// third, equally-weighted action for the client, not a buried extra.
export function ReviewComments({
  open,
  token,
  postId,
  canComment,
  reviewerName,
  initialComments,
  onCommentsChange,
}: {
  open: boolean;
  token: string;
  postId: string;
  canComment: boolean;
  reviewerName: string;
  initialComments: ReviewCommentItem[];
  onCommentsChange?: (comments: ReviewCommentItem[]) => void;
}) {
  const [comments, setComments] = useState(initialComments);
  const [name, setName] = useState(reviewerName);
  const [draft, setDraft] = useState("");
  const [isPending, startTransition] = useTransition();

  function updateComments(next: ReviewCommentItem[]) {
    setComments(next);
    onCommentsChange?.(next);
  }

  function submit() {
    const text = draft.trim();
    if (!text) return;
    startTransition(async () => {
      try {
        const comment = await addReviewCommentAction(token, postId, name, text);
        updateComments([...comments, comment]);
        setDraft("");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Senden fehlgeschlagen.");
      }
    });
  }

  function toggleResolved(commentId: string, resolved: boolean) {
    updateComments(comments.map((c) => (c.id === commentId ? { ...c, resolved } : c)));
    startTransition(async () => {
      await toggleReviewCommentResolvedAction(token, postId, commentId, resolved);
    });
  }

  if (!open || (!canComment && comments.length === 0)) return null;

  return (
    <div className="border-t pt-3">
      <div className="flex flex-col gap-3">
        {comments.map((comment) => (
          <div key={comment.id} className="rounded-md bg-muted/50 p-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">
                {comment.authorType === "INTERNAL" ? "Team: " : "Kunde: "}
                {comment.authorUser?.name ?? comment.authorUser?.email ?? comment.authorName ?? "?"}
              </span>
              {canComment && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleResolved(comment.id, !comment.resolved)}
                >
                  {comment.resolved ? "Wieder öffnen" : "Als erledigt markieren"}
                </Button>
              )}
            </div>
            <p className={comment.resolved ? "text-muted-foreground line-through" : ""}>
              {comment.text}
            </p>
          </div>
        ))}

        {canComment && (
          <div className="flex flex-col gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Dein Name" />
            <div className="flex gap-2">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Kommentar hinzufügen…"
                rows={2}
                className="flex-1"
              />
              <Button type="button" size="sm" disabled={isPending} onClick={submit}>
                Senden
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
