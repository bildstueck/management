"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/dal";
import { requireWorkspaceRole } from "@/lib/workspaces";
import { addMemberByEmail, removeMember, updateMemberRole, MemberActionError } from "@/lib/members";
import type { MembershipRole } from "@prisma/client";

export type MemberActionState = { error?: string } | undefined;

export async function addMemberAction(
  _prevState: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  const slug = formData.get("slug") as string;
  const email = (formData.get("email") as string | null)?.trim();
  const role = (formData.get("role") as MembershipRole | null) ?? "EDITOR";

  if (!email) return { error: "Bitte eine E-Mail angeben." };

  const user = await requireUser();
  const workspace = await requireWorkspaceRole(slug, user.id, ["OWNER"]);

  try {
    await addMemberByEmail(workspace.id, email, role);
  } catch (error) {
    if (error instanceof MemberActionError) return { error: error.message };
    throw error;
  }
  revalidatePath(`/w/${slug}/members`);
}

export async function removeMemberAction(slug: string, membershipId: string) {
  const user = await requireUser();
  const workspace = await requireWorkspaceRole(slug, user.id, ["OWNER"]);

  await removeMember(workspace.id, membershipId);
  revalidatePath(`/w/${slug}/members`);
}

export async function updateMemberRoleAction(
  slug: string,
  membershipId: string,
  role: MembershipRole,
) {
  const user = await requireUser();
  const workspace = await requireWorkspaceRole(slug, user.id, ["OWNER"]);

  await updateMemberRole(workspace.id, membershipId, role);
  revalidatePath(`/w/${slug}/members`);
}
