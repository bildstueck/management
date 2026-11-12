import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/dal";
import { requireWorkspaceRole } from "@/lib/workspaces";
import { verifyOAuthState } from "@/lib/oauth/state";
import {
  exchangeLinkedInCodeForToken,
  fetchLinkedInUserInfo,
  fetchLinkedInAdminOrganizations,
} from "@/lib/oauth/linkedin";
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
    const redirectUri = new URL("/api/connect/linkedin/callback", origin).toString();
    const token = await exchangeLinkedInCodeForToken(code, redirectUri);
    const profile = await fetchLinkedInUserInfo(token.access_token);

    const tokenExpiresAt = new Date(Date.now() + token.expires_in * 1000);

    await upsertSocialAccount({
      workspaceId: workspace.id,
      platform: "LINKEDIN",
      externalAccountId: profile.sub,
      displayName: profile.name,
      avatarUrl: profile.picture,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      tokenExpiresAt,
    });

    let connectedCount = 1;
    const organizations = await fetchLinkedInAdminOrganizations(token.access_token);
    for (const org of organizations) {
      await upsertSocialAccount({
        workspaceId: workspace.id,
        platform: "LINKEDIN",
        externalAccountId: `org:${org.id}`,
        displayName: org.name,
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        tokenExpiresAt,
      });
      connectedCount++;
    }

    return NextResponse.redirect(
      accountsUrl(origin, workspace.slug, { connected: "linkedin", count: String(connectedCount) }),
    );
  } catch (error) {
    console.error("LinkedIn connect failed:", error);
    return NextResponse.redirect(
      accountsUrl(origin, workspace.slug, { error: "connect_failed" }),
    );
  }
}
