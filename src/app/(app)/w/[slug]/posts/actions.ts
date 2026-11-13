"use server";

import { z } from "zod";
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
  return { id: post.id };
}

export async function deletePostAction(formData: FormData) {
  const slug = formData.get("slug") as string;
  const postId = formData.get("postId") as string;

  const user = await requireUser();
  const workspace = await requireWorkspaceMember(slug, user.id);
  await deletePost(workspace.id, postId);
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
}

export async function addCommentAction(slug: string, postId: string, text: string) {
  const user = await requireUser();
  const workspace = await requireWorkspaceMember(slug, user.id);
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Kommentar darf nicht leer sein.");

  // Defense in depth: the post must actually belong to this workspace.
  await getPost(workspace.id, postId);

  return addInternalComment(postId, user.id, trimmed);
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
}

export async function submitForApprovalAction(formData: FormData) {
  const slug = formData.get("slug") as string;
  const postId = formData.get("postId") as string;

  const user = await requireUser();
  const workspace = await requireWorkspaceMember(slug, user.id);
  await submitForApproval(workspace.id, postId, user.id);
}

export async function revertToDraftAction(formData: FormData) {
  const slug = formData.get("slug") as string;
  const postId = formData.get("postId") as string;

  const user = await requireUser();
  const workspace = await requireWorkspaceMember(slug, user.id);
  await revertToDraft(workspace.id, postId, user.id);
}

// Marks an APPROVED (or previously FAILED) post SCHEDULED. If its
// scheduledAt is already due (or unset), the GitHub Actions-triggered
// /api/cron/publish route picks it up within a few minutes; schedulePostAction
// itself doesn't wait for that.
export async function schedulePostAction(formData: FormData) {
  const slug = formData.get("slug") as string;
  const postId = formData.get("postId") as string;

  const user = await requireUser();
  const workspace = await requireWorkspaceMember(slug, user.id);
  await scheduleForPublish(workspace.id, postId, user.id);
}

// Same status transition as schedulePostAction, but publishes right away in
// this same request instead of waiting for the cron route.
export async function publishNowAction(formData: FormData) {
  const slug = formData.get("slug") as string;
  const postId = formData.get("postId") as string;

  const user = await requireUser();
  const workspace = await requireWorkspaceMember(slug, user.id);

  await scheduleForPublish(workspace.id, postId, user.id);
  await publishPost(postId);
}

export async function cancelScheduleAction(formData: FormData) {
  const slug = formData.get("slug") as string;
  const postId = formData.get("postId") as string;

  const user = await requireUser();
  const workspace = await requireWorkspaceMember(slug, user.id);
  await cancelSchedule(workspace.id, postId, user.id);
}
