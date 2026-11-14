import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/dal";
import { requireWorkspaceRole } from "@/lib/workspaces";
import { verifyOAuthState } from "@/lib/oauth/state";
import {
  exchangeMetaCodeForToken,
  listAssignedInstagramAccounts,
  fetchInstagramProfilePicture,
} from "@/lib/oauth/meta";
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
    // Unified Login exchanges the code the same way as the Facebook Page
    // flow and returns a Business Integration System User access token —
    // no long-lived-token exchange step, unlike a Facebook user token.
    const { access_token: systemUserToken } = await exchangeMetaCodeForToken(code, redirectUri);
    const accounts = await listAssignedInstagramAccounts(systemUserToken);

    for (const account of accounts) {
      const avatarUrl = await fetchInstagramProfilePicture(account.id, systemUserToken);
      await upsertSocialAccount({
        workspaceId: workspace.id,
        platform: "INSTAGRAM",
        externalAccountId: account.id,
        displayName: account.username,
        avatarUrl,
        accessToken: systemUserToken,
        tokenExpiresAt: null, // Business Integration System User tokens don't expire on a fixed schedule
      });
    }

    return NextResponse.redirect(
      accountsUrl(origin, workspace.slug, { connected: "instagram", count: String(accounts.length) }),
    );
  } catch (error) {
    console.error("Instagram connect failed:", error);
    return NextResponse.redirect(accountsUrl(origin, workspace.slug, { error: "connect_failed" }));
  }
}
