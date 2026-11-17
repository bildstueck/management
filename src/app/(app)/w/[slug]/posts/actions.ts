"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/dal";
import { requireWorkspaceMember } from "@/lib/workspaces";
import { listSocialAccounts } from "@/lib/social-accounts";
import {
  savePost,
  deletePost,
  reschedulePost,
  getPost,
  submitForApproval,
  revertToDraft,
  scheduleForPublish,
  cancelSchedule,
} from "@/lib/posts";
import { addInternalComment, setCommentResolved } from "@/lib/comments";
import { createMedia } from "@/lib/media";
import {
  createPresignedUpload,
  mediaTypeForContentType,
  maxBytesForContentType,
} from "@/lib/s3-upload";
import { publishPost } from "@/lib/publish-post";

// Next.js 16 does not re-render the current route after a Server Action
// unless the action explicitly asks for it — every mutation here needs this
// or the Feed/Calendar/Grid views (and the workspace overview, which embeds
// the calendar) keep showing stale data until a manual reload.
function revalidatePosts(slug: string, postId?: string) {
  revalidatePath(`/w/${slug}/posts`, "layout");
  revalidatePath(`/w/${slug}`);
  if (postId) revalidatePath(`/w/${slug}/posts/${postId}`);
}

export async function requestMediaUploadAction(
  slug: string,
  filename: string,
  contentType: string,
  sizeBytes: number,
) {
  const user = await requireUser();
  const workspace = await requireWorkspaceMember(slug, user.id);

  const mediaType = mediaTypeForContentType(contentType);
  if (!mediaType) {
    throw new Error(`Dateityp "${contentType}" wird nicht unterstützt (nur JPEG/PNG/MP4).`);
  }
  const maxBytes = maxBytesForContentType(contentType);
  if (sizeBytes > maxBytes) {
    throw new Error(`Datei zu groß (max. ${Math.round(maxBytes / 1024 / 1024)}MB).`);
  }

  const upload = await createPresignedUpload(workspace.id, filename, contentType);
  return { ...upload, mediaType };
}

const ConfirmMediaSchema = z.object({
  storageKey: z.string().min(1),
  url: z.url(),
  type: z.enum(["IMAGE", "VIDEO"]),
  width: z.number().int().positive().nullish(),
  height: z.number().int().positive().nullish(),
  durationMs: z.number().int().positive().nullish(),
});

export async function confirmMediaUploadAction(
  slug: string,
  input: z.infer<typeof ConfirmMediaSchema>,
) {
  const user = await requireUser();
  const workspace = await requireWorkspaceMember(slug, user.id);
  const data = ConfirmMediaSchema.parse(input);

  return createMedia({
    workspaceId: workspace.id,
    type: data.type,
    storageKey: data.storageKey,
    url: data.url,
    width: data.width,
    height: data.height,
    durationMs: data.durationMs,
  });
}

const SavePostSchema = z.object({
  postId: z.string().optional(),
  masterText: z.string().nullable(),
  masterMediaIds: z.array(z.string()),
  scheduledAt: z.string().nullable().optional(), // "YYYY-MM-DD"
  channels: z.array(
    z.object({
      socialAccountId: z.string(),
      text: z.string().nullable(),
      mediaIds: z.array(z.string()),
    }),
  ),
});

export async function savePostAction(slug: string, input: z.infer<typeof SavePostSchema>) {
  const user = await requireUser();
  const workspace = await requireWorkspaceMember(slug, user.id);
  const data = SavePostSchema.parse(input);

  // Defense in depth: only accept channels whose SocialAccount actually
  // belongs to this workspace (the client only offers these, but the action
  // is a public endpoint, so re-check server-side).
  const validAccountIds = new Set((await listSocialAccounts(workspace.id)).map((a) => a.id));
  const channels = data.channels.filter((c) => validAccountIds.has(c.socialAccountId));

  const post = await savePost(workspace.id, user.id, {
    ...data,
    channels,
    scheduledAt: data.scheduledAt === undefined ? undefined : data.scheduledAt ? new Date(`${data.scheduledAt}T09:00:00`) : null,
  });
  revalidatePosts(slug, post.id);
  return { id: post.id };
}

export async function deletePostAction(slug: string, postId: string) {
  const user = await requireUser();
  const workspace = await requireWorkspaceMember(slug, user.id);
  await deletePost(workspace.id, postId);
  revalidatePosts(slug);
}

// `isoDate` is a plain "YYYY-MM-DD" (from a date-only picker or a calendar
// day cell), interpreted in the server's local time; `null` unschedules it.
// Scheduling here only sets the target date — it does not move the post
// through the approval workflow (that lands in Phase 4) or queue it for
// publishing (Phase 5).
export async function reschedulePostAction(slug: string, postId: string, isoDate: string | null) {
  const user = await requireUser();
  const workspace = await requireWorkspaceMember(slug, user.id);
  const date = isoDate ? new Date(`${isoDate}T09:00:00`) : null;
  await reschedulePost(workspace.id, postId, date);
  revalidatePosts(slug, postId);
}

export async function addCommentAction(slug: string, postId: string, text: string) {
  const user = await requireUser();
  const workspace = await requireWorkspaceMember(slug, user.id);
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Kommentar darf nicht leer sein.");

  // Defense in depth: the post must actually belong to this workspace.
  await getPost(workspace.id, postId);

  const comment = await addInternalComment(postId, user.id, trimmed);
  revalidatePosts(slug, postId);
  return comment;
}

export async function toggleCommentResolvedAction(
  slug: string,
  postId: string,
  commentId: string,
  resolved: boolean,
) {
  const user = await requireUser();
  const workspace = await requireWorkspaceMember(slug, user.id);
  await getPost(workspace.id, postId);

  await setCommentResolved(postId, commentId, resolved);
  revalidatePosts(slug, postId);
}

export async function submitForApprovalAction(slug: string, postId: string) {
  const user = await requireUser();
  const workspace = await requireWorkspaceMember(slug, user.id);
  await submitForApproval(workspace.id, postId, user.id);
  revalidatePosts(slug, postId);
}

export async function revertToDraftAction(slug: string, postId: string) {
  const user = await requireUser();
  const workspace = await requireWorkspaceMember(slug, user.id);
  await revertToDraft(workspace.id, postId, user.id);
  revalidatePosts(slug, postId);
}

// Marks an APPROVED (or previously FAILED) post SCHEDULED. If its
// scheduledAt is already due (or unset), the GitHub Actions-triggered
// /api/cron/publish route picks it up within a few minutes; schedulePostAction
// itself doesn't wait for that.
export async function schedulePostAction(slug: string, postId: string) {
  const user = await requireUser();
  const workspace = await requireWorkspaceMember(slug, user.id);
  await scheduleForPublish(workspace.id, postId, user.id);
  revalidatePosts(slug, postId);
}

// Same status transition as schedulePostAction, but publishes right away in
// this same request instead of waiting for the cron route.
export async function publishNowAction(slug: string, postId: string) {
  const user = await requireUser();
  const workspace = await requireWorkspaceMember(slug, user.id);

  await scheduleForPublish(workspace.id, postId, user.id);
  await publishPost(postId);
  revalidatePosts(slug, postId);
}

export async function cancelScheduleAction(slug: string, postId: string) {
  const user = await requireUser();
  const workspace = await requireWorkspaceMember(slug, user.id);
  await cancelSchedule(workspace.id, postId, user.id);
  revalidatePosts(slug, postId);
}
