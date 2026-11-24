"use client";

import { useEffect } from "react";
import { touchMembershipViewedAction } from "@/app/(app)/w/[slug]/actions";

// Invisible — just marks this workspace as "viewed" by the current user the
// moment the page actually mounts in the browser. Rendering this inside the
// workspace layout, not calling the action during the server render itself,
// is deliberate: Next.js Link prefetch only renders the static shell of a
// dynamic route, so an effect here (unlike a server-side write in the
// layout) never fires just because a sidebar link was hovered.
export function MarkWorkspaceViewed({ slug }: { slug: string }) {
  useEffect(() => {
    touchMembershipViewedAction(slug).catch(() => {
      // Best-effort — a failed "viewed" timestamp isn't worth surfacing.
    });
  }, [slug]);

  return null;
}
