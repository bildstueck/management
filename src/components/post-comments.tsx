"use client";

import { useState, useTransition } from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addCommentAction, toggleCommentResolvedAction } from "@/app/(app)/w/[slug]/posts/actions";

export type CommentItem = {
  id: string;
  text: string;
  resolved: boolean;
  createdAt: string | Date;
  authorUser: { id: string; name: string | null; email: string } | null;
  authorName: string | null;
};

export function PostComments({
  slug,
  postId,
  initialComments,
}: {
  slug: string;
  postId: string;
  initialComments: CommentItem[];
}) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState(initialComments);
  const [draft, setDraft] = useState("");
  const [isPending, startTransition] = useTransition();

  function submitComment() {
    const text = draft.trim();
    if (!text) return;
    startTransition(async () => {
      const comment = await addCommentAction(slug, postId, text);
      setComments((prev) => [...prev, comment]);
      setDraft("");
    });
  }

  function toggleResolved(commentId: string, resolved: boolean) {
    setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, resolved } : c)));
    startTransition(async () => {
      await toggleCommentResolvedAction(slug, postId, commentId, resolved);
    });
  }

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
                  {comment.authorUser?.name ?? comment.authorUser?.email ?? comment.authorName ?? "?"}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleResolved(comment.id, !comment.resolved)}
                >
                  {comment.resolved ? "Wieder öffnen" : "Als erledigt markieren"}
                </Button>
              </div>
              <p className={comment.resolved ? "text-muted-foreground line-through" : ""}>
                {comment.text}
              </p>
            </div>
          ))}

          <div className="flex gap-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Kommentar hinzufügen…"
              rows={2}
              className="flex-1"
            />
            <Button type="button" size="sm" disabled={isPending} onClick={submitComment}>
              Senden
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
