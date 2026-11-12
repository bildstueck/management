"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { createWorkspace } from "@/lib/workspaces";

export type CreateWorkspaceState = { error?: string } | undefined;

export async function createWorkspaceAction(
  _prevState: CreateWorkspaceState,
  formData: FormData,
): Promise<CreateWorkspaceState> {
  const user = await requireUser();
  const name = (formData.get("name") as string | null)?.trim();
  if (!name) return { error: "Bitte einen Namen angeben." };

  const workspace = await createWorkspace(user.id, name);
  redirect(`/w/${workspace.slug}`);
}
