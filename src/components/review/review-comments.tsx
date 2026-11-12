"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MessageSquare } from "lucide-react";
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

export function ReviewComments({
  token,
  postId,
  canComment,
  reviewerName,
  initialComments,
}: {
  token: string;
  postId: string;
  canComment: boolean;
  reviewerName: string;
  initialComments: ReviewCommentItem[];
}) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState(initialComments);
  const [name, setName] = useState(reviewerName);
  const [draft, setDraft] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit() {
    const text = draft.trim();
    if (!text) return;
    startTransition(async () => {
      try {
        const comment = await addReviewCommentAction(token, postId, name, text);
        setComments((prev) => [...prev, comment]);
        setDraft("");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Senden fehlgeschlagen.");
      }
    });
  }

  function toggleResolved(commentId: string, resolved: boolean) {
    setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, resolved } : c)));
    startTransition(async () => {
      await toggleReviewCommentResolvedAction(token, postId, commentId, resolved);
    });
  }

  if (!canComment && comments.length === 0) return null;

  return (
    <div className="border-t pt-2">
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
        <MessageSquare className="size-3.5" />
        {comments.length === 0 ? "Kommentieren" : `${comments.length} Kommentar(e)`}
      </Button>

      {open && (
        <div className="mt-2 flex flex-col gap-3">
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
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Dein Name"
              />
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
      )}
    </div>
  );
}
