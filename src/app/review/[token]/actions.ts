"use server";

import { getShareLinkByToken, verifyShareLinkPassword } from "@/lib/share-links";
import { markShareLinkUnlocked, setReviewerName } from "@/lib/share-link-session";
import { approvePost, updatePostTextByReviewer, postBelongsToWorkspace } from "@/lib/posts";
import { addExternalComment, setCommentResolved } from "@/lib/comments";

// Public, token-authenticated actions for the magic-link review page
// (src/app/review/[token]/page.tsx). There is no NextAuth session here —
// every action re-resolves and re-checks the share link's own permissions,
// since this is a public endpoint callable by anyone with the link.

class ShareLinkError extends Error {}

async function requireLink(token: string) {
  const link = await getShareLinkByToken(token);
  if (!link) throw new ShareLinkError("Link ungültig oder abgelaufen.");
  return link;
}

async function requirePostInWorkspace(workspaceId: string, postId: string) {
  if (!(await postBelongsToWorkspace(workspaceId, postId))) {
    throw new ShareLinkError("Beitrag nicht gefunden.");
  }
}

export type UnlockState = { error?: string } | undefined;

export async function unlockShareLinkAction(
  token: string,
  _prevState: UnlockState,
  formData: FormData,
): Promise<UnlockState> {
  const link = await requireLink(token);
  const password = (formData.get("password") as string | null) ?? "";
  const valid = await verifyShareLinkPassword(link, password);
  if (!valid) return { error: "Falsches Passwort." };
  await markShareLinkUnlocked(link.id);
  return undefined;
}

export async function addReviewCommentAction(
  token: string,
  postId: string,
  name: string,
  text: string,
) {
  const link = await requireLink(token);
  if (!link.canComment) throw new ShareLinkError("Kommentare sind für diesen Link nicht erlaubt.");
  await requirePostInWorkspace(link.workspaceId, postId);

  const trimmedText = text.trim();
  if (!trimmedText) throw new ShareLinkError("Kommentar darf nicht leer sein.");
  const authorName = name.trim() || "Kunde";

  await setReviewerName(authorName);
  return addExternalComment(postId, authorName, trimmedText);
}

export async function toggleReviewCommentResolvedAction(
  token: string,
  postId: string,
  commentId: string,
  resolved: boolean,
) {
  const link = await requireLink(token);
  if (!link.canComment) throw new ShareLinkError("Nicht erlaubt.");
  await requirePostInWorkspace(link.workspaceId, postId);
  await setCommentResolved(postId, commentId, resolved);
}

export async function approveReviewPostAction(token: string, postId: string, name: string) {
  const link = await requireLink(token);
  if (!link.canApprove) throw new ShareLinkError("Freigeben ist für diesen Link nicht erlaubt.");
  await requirePostInWorkspace(link.workspaceId, postId);

  const authorName = name.trim() || "Kunde";
  await setReviewerName(authorName);
  return approvePost(link.workspaceId, postId, { name: authorName });
}

export async function editReviewPostTextAction(
  token: string,
  postId: string,
  name: string,
  newText: string,
) {
  const link = await requireLink(token);
  if (!link.canEdit) throw new ShareLinkError("Bearbeiten ist für diesen Link nicht erlaubt.");
  await requirePostInWorkspace(link.workspaceId, postId);

  const authorName = name.trim() || "Kunde";
  await setReviewerName(authorName);
  await updatePostTextByReviewer(link.workspaceId, postId, newText, authorName);
}
