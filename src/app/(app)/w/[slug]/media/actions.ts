"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/dal";
import { requireWorkspaceMember } from "@/lib/workspaces";
import { deleteMedia } from "@/lib/media";

export async function deleteMediaAction(slug: string, mediaId: string) {
  const user = await requireUser();
  const workspace = await requireWorkspaceMember(slug, user.id);
  await deleteMedia(workspace.id, mediaId);
  revalidatePath(`/w/${slug}/media`);
}
