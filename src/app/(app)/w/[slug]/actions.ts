"use server";

import { requireUser } from "@/lib/dal";
import { requireWorkspaceMember, touchMembershipViewed } from "@/lib/workspaces";

// Called client-side on mount (see MarkWorkspaceViewed) rather than during
// the page's own server render, so a mere Link prefetch (which only renders
// the static shell, not this effect) never counts as "viewed".
export async function touchMembershipViewedAction(slug: string) {
  const user = await requireUser();
  await requireWorkspaceMember(slug, user.id);
  await touchMembershipViewed(slug, user.id);
}
