"use server";

import { requireUser } from "@/lib/dal";
import { requireWorkspaceRole } from "@/lib/workspaces";
import { createShareLink, deleteShareLink } from "@/lib/share-links";

export type CreateShareLinkState = { error?: string } | undefined;

export async function createShareLinkAction(
  _prevState: CreateShareLinkState,
  formData: FormData,
): Promise<CreateShareLinkState> {
  const slug = formData.get("slug") as string;
  const password = (formData.get("password") as string | null)?.trim() || null;
  const expiresInDays = Number(formData.get("expiresInDays") ?? "");

  const user = await requireUser();
  const workspace = await requireWorkspaceRole(slug, user.id, ["OWNER"]);

  const expiresAt =
    Number.isFinite(expiresInDays) && expiresInDays > 0
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

  await createShareLink(workspace.id, {
    password,
    expiresAt,
    canComment: formData.get("canComment") === "on",
    canApprove: formData.get("canApprove") === "on",
    canEdit: formData.get("canEdit") === "on",
  });
  return undefined;
}

export async function deleteShareLinkAction(formData: FormData) {
  const slug = formData.get("slug") as string;
  const id = formData.get("id") as string;

  const user = await requireUser();
  const workspace = await requireWorkspaceRole(slug, user.id, ["OWNER"]);
  await deleteShareLink(workspace.id, id);
}
