"use server";

import { z } from "zod";
import { requireUser } from "@/lib/dal";
import { requireWorkspaceMember } from "@/lib/workspaces";
import { listSocialAccounts } from "@/lib/social-accounts";
import { savePost, deletePost } from "@/lib/posts";
import { createMedia } from "@/lib/media";
import {
  createPresignedUpload,
  mediaTypeForContentType,
  maxBytesForContentType,
} from "@/lib/s3-upload";

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

  const post = await savePost(workspace.id, user.id, { ...data, channels });
  return { id: post.id };
}

export async function deletePostAction(formData: FormData) {
  const slug = formData.get("slug") as string;
  const postId = formData.get("postId") as string;

  const user = await requireUser();
  const workspace = await requireWorkspaceMember(slug, user.id);
  await deletePost(workspace.id, postId);
}
