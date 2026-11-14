import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptRefreshToken } from "@/lib/social-accounts";
import { encryptToken } from "@/lib/encryption";
import { refreshLinkedInAccessToken } from "@/lib/oauth/linkedin";

// Hit daily by .github/workflows/cron.yml. Same Bearer-token boundary as
// /api/cron/publish — see that route's comment.
//
// LinkedIn-only: it's the one platform here that issues a refresh_token
// (when the app has programmatic refresh access). Meta Page tokens and
// Instagram Business Integration System User tokens (Unified Login) have
// no silent-refresh mechanism — an expiring/invalidated one just shows up
// as "Läuft bald ab" on the Accounts page, prompting the Owner to
// reconnect.
export const maxDuration = 60;

const REFRESH_WINDOW_MS = 48 * 60 * 60 * 1000;

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dueBefore = new Date(Date.now() + REFRESH_WINDOW_MS);
  const accounts = await prisma.socialAccount.findMany({
    where: { platform: "LINKEDIN", refreshTokenEnc: { not: null }, tokenExpiresAt: { lt: dueBefore } },
  });

  let refreshed = 0;
  for (const account of accounts) {
    const refreshToken = decryptRefreshToken(account);
    if (!refreshToken) continue;

    try {
      const result = await refreshLinkedInAccessToken(refreshToken);
      await prisma.socialAccount.update({
        where: { id: account.id },
        data: {
          accessTokenEnc: encryptToken(result.access_token),
          refreshTokenEnc: result.refresh_token
            ? encryptToken(result.refresh_token)
            : account.refreshTokenEnc,
          tokenExpiresAt: new Date(Date.now() + result.expires_in * 1000),
        },
      });
      refreshed++;
    } catch (error) {
      console.error(`[cron/refresh-tokens] Failed for account ${account.id}:`, error);
    }
  }

  return NextResponse.json({ checked: accounts.length, refreshed });
}
