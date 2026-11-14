import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/dal";
import { requireWorkspaceRole } from "@/lib/workspaces";
import { verifyOAuthState } from "@/lib/oauth/state";
import {
  exchangeMetaCodeForToken,
  exchangeMetaForLongLivedToken,
  listMetaPages,
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
    const redirectUri = new URL("/api/connect/meta/callback", origin).toString();
    const shortLived = await exchangeMetaCodeForToken(code, redirectUri);
    const longLived = await exchangeMetaForLongLivedToken(shortLived.access_token);
    const pages = await listMetaPages(longLived.access_token);

    // Facebook Pages only — Instagram connects separately via
    // /api/connect/instagram (Instagram API with Instagram Login), which
    // needs no linked Facebook Page.
    for (const page of pages) {
      await upsertSocialAccount({
        workspaceId: workspace.id,
        platform: "FACEBOOK",
        externalAccountId: page.id,
        displayName: page.name,
        accessToken: page.access_token,
        tokenExpiresAt: null, // page tokens derived from a long-lived user token don't expire on a fixed schedule
      });
    }

    return NextResponse.redirect(
      accountsUrl(origin, workspace.slug, { connected: "meta", count: String(pages.length) }),
    );
  } catch (error) {
    console.error("Meta connect failed:", error);
    return NextResponse.redirect(
      accountsUrl(origin, workspace.slug, { error: "connect_failed" }),
    );
  }
}
