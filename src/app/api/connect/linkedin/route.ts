import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/dal";
import { requireWorkspaceRole } from "@/lib/workspaces";
import { createOAuthState } from "@/lib/oauth/state";
import { buildLinkedInAuthorizeUrl } from "@/lib/oauth/linkedin";

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("workspace");
  if (!slug) return NextResponse.json({ error: "Missing workspace" }, { status: 400 });

  const user = await requireUser();
  await requireWorkspaceRole(slug, user.id, ["OWNER"]);

  const state = createOAuthState(slug, user.id);
  const redirectUri = new URL(
    "/api/connect/linkedin/callback",
    request.nextUrl.origin,
  ).toString();

  return NextResponse.redirect(buildLinkedInAuthorizeUrl(state, redirectUri));
}
