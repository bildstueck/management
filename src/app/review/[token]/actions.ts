"use server";

import { revalidatePath } from "next/cache";
import { getShareLinkByToken, verifyShareLinkPassword } from "@/lib/share-links";
import { markShareLinkUnlocked, setReviewerName } from "@/lib/share-link-session";
import { approvePost, rejectPost, updatePostTextByReviewer, getPostLite } from "@/lib/posts";
import { addExternalComment, setCommentResolved } from "@/lib/comments";
import { createMedia } from "@/lib/media";
import {
  createPresignedUpload,
  mediaTypeForContentType,
  maxBytesForContentType,
} from "@/lib/s3-upload";
import { z } from "zod";

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
  const post = await getPostLite(workspaceId, postId);
  if (!post) throw new ShareLinkError("Beitrag nicht gefunden.");
  return post;
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
  const result = await approvePost(link.workspaceId, postId, { name: authorName });
  revalidatePath(`/w/${link.workspace.slug}/posts`, "layout");
  revalidatePath(`/w/${link.workspace.slug}/posts/${postId}`);
  return result;
}

export async function rejectReviewPostAction(
  token: string,
  postId: string,
  name: string,
  reason: string,
) {
  const link = await requireLink(token);
  if (!link.canApprove) throw new ShareLinkError("Ablehnen ist für diesen Link nicht erlaubt.");
  await requirePostInWorkspace(link.workspaceId, postId);

  const authorName = name.trim() || "Kunde";
  await setReviewerName(authorName);
  const trimmedReason = reason.trim();
  const result = await rejectPost(
    link.workspaceId,
    postId,
    { name: authorName },
    trimmedReason ? `Abgelehnt: ${trimmedReason}` : "Abgelehnt",
  );
  revalidatePath(`/w/${link.workspace.slug}/posts`, "layout");
  revalidatePath(`/w/${link.workspace.slug}/posts/${postId}`);
  return result;
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
  revalidatePath(`/w/${link.workspace.slug}/posts`, "layout");
  revalidatePath(`/w/${link.workspace.slug}/posts/${postId}`);
}

// Lets a client submit their own photos/videos through the link — these
// land in the workspace's media library for the team to use in posts, the
// same library the composer picks from. Not attached to any post directly.
export async function requestReviewMediaUploadAction(
  token: string,
  filename: string,
  contentType: string,
  sizeBytes: number,
) {
  const link = await requireLink(token);
  if (!link.canUpload) throw new ShareLinkError("Hochladen ist für diesen Link nicht erlaubt.");

  const mediaType = mediaTypeForContentType(contentType);
  if (!mediaType) {
    throw new ShareLinkError(`Dateityp "${contentType}" wird nicht unterstützt (nur JPEG/PNG/MP4).`);
  }
  const maxBytes = maxBytesForContentType(contentType);
  if (sizeBytes > maxBytes) {
    throw new ShareLinkError(`Datei zu groß (max. ${Math.round(maxBytes / 1024 / 1024)}MB).`);
  }

  const upload = await createPresignedUpload(link.workspaceId, filename, contentType);
  return { ...upload, mediaType };
}

const ConfirmReviewMediaSchema = z.object({
  storageKey: z.string().min(1),
  url: z.url(),
  type: z.enum(["IMAGE", "VIDEO"]),
  width: z.number().int().positive().nullish(),
  height: z.number().int().positive().nullish(),
  durationMs: z.number().int().positive().nullish(),
});

export async function confirmReviewMediaUploadAction(
  token: string,
  input: z.infer<typeof ConfirmReviewMediaSchema>,
) {
  const link = await requireLink(token);
  if (!link.canUpload) throw new ShareLinkError("Hochladen ist für diesen Link nicht erlaubt.");
  const data = ConfirmReviewMediaSchema.parse(input);

  return createMedia({
    workspaceId: link.workspaceId,
    type: data.type,
    storageKey: data.storageKey,
    url: data.url,
    width: data.width,
    height: data.height,
    durationMs: data.durationMs,
  });
}
