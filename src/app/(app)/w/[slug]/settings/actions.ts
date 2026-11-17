"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/dal";
import { requireWorkspaceRole } from "@/lib/workspaces";
import { updateWorkspaceColor, updateWorkspaceName, deleteWorkspace } from "@/lib/workspaces";

export async function updateWorkspaceColorAction(slug: string, color: string) {
  const user = await requireUser();
  const workspace = await requireWorkspaceRole(slug, user.id, ["OWNER"]);
  await updateWorkspaceColor(workspace.id, color);
  revalidatePath(`/w/${slug}`, "layout");
  revalidatePath("/dashboard");
}

export async function updateWorkspaceNameAction(slug: string, name: string) {
  const user = await requireUser();
  const workspace = await requireWorkspaceRole(slug, user.id, ["OWNER"]);
  await updateWorkspaceName(workspace.id, name);
  revalidatePath(`/w/${slug}`, "layout");
  revalidatePath("/dashboard");
  revalidatePath(`/review`, "layout");
}

export async function deleteWorkspaceAction(slug: string) {
  const user = await requireUser();
  const workspace = await requireWorkspaceRole(slug, user.id, ["OWNER"]);
  await deleteWorkspace(workspace.id);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
