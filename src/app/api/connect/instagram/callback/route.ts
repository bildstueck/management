import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/dal";
import { requireWorkspaceRole } from "@/lib/workspaces";
import { verifyOAuthState } from "@/lib/oauth/state";
import {
  exchangeInstagramCodeForToken,
  exchangeInstagramForLongLivedToken,
  fetchInstagramProfile,
} from "@/lib/oauth/instagram";
import { upsertSocialAccount } from "@/lib/social-accounts";

function accountsUrl(origin: string, slug: string, params: Record<string, string>) {
  const url = new URL(`/w/${slug}/accounts`, origin);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const stateToken = searchParams.get("state");
  const oauthError = searchParams.get("error_description") ?? searchParams.get("error");

  const state = stateToken ? verifyOAuthState(stateToken) : null;
  if (!state) {
    return NextResponse.json({ error: "Invalid or expired OAuth state" }, { status: 400 });
  }

  const user = await requireUser();
  if (user.id !== state.userId) {
    return NextResponse.json({ error: "Session mismatch" }, { status: 400 });
  }
  const workspace = await requireWorkspaceRole(state.workspaceSlug, user.id, ["OWNER"]);

  if (oauthError || !code) {
    return NextResponse.redirect(
      accountsUrl(origin, workspace.slug, { error: oauthError ?? "missing_code" }),
    );
  }

  try {
    const redirectUri = new URL("/api/connect/instagram/callback", origin).toString();
    const shortLived = await exchangeInstagramCodeForToken(code, redirectUri);
    const longLived = await exchangeInstagramForLongLivedToken(shortLived.accessToken);
    const profile = await fetchInstagramProfile(shortLived.userId, longLived.access_token);

    await upsertSocialAccount({
      workspaceId: workspace.id,
      platform: "INSTAGRAM",
      externalAccountId: profile.id,
      displayName: profile.username,
      avatarUrl: profile.profile_picture_url,
      accessToken: longLived.access_token,
      tokenExpiresAt: new Date(Date.now() + longLived.expires_in * 1000),
    });

    return NextResponse.redirect(
      accountsUrl(origin, workspace.slug, { connected: "instagram", count: "1" }),
    );
  } catch (error) {
    console.error("Instagram connect failed:", error);
    return NextResponse.redirect(accountsUrl(origin, workspace.slug, { error: "connect_failed" }));
  }
}
