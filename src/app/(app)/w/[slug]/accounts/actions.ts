"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/dal";
import { requireWorkspaceRole } from "@/lib/workspaces";
import { disconnectSocialAccount } from "@/lib/social-accounts";

export async function disconnectAccountAction(slug: string, accountId: string) {
  const user = await requireUser();
  const workspace = await requireWorkspaceRole(slug, user.id, ["OWNER"]);

  await disconnectSocialAccount(workspace.id, accountId);
  revalidatePath(`/w/${slug}/accounts`);
}
