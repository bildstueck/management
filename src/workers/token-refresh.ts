import "dotenv/config";
import { Queue, Worker } from "bullmq";
import { redis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { decryptRefreshToken } from "@/lib/social-accounts";
import { encryptToken } from "@/lib/encryption";
import { refreshLinkedInAccessToken } from "@/lib/oauth/linkedin";

// Background job: proactively refreshes OAuth tokens before they expire.
//
// - LinkedIn issues a refresh_token (when the app has programmatic refresh
//   token access) that can silently mint a new access token — we use it.
// - Meta has no equivalent for Page/long-lived user tokens: once one is
//   close to expiring, the only fix is the workspace owner reconnecting via
//   the UI (see the "Läuft bald ab" status on the Accounts page). So Meta
//   accounts are left alone here; nothing to silently refresh.

const QUEUE_NAME = "token-refresh";
const REFRESH_WINDOW_MS = 48 * 60 * 60 * 1000; // refresh when <48h from expiry
const RUN_EVERY_MS = 6 * 60 * 60 * 1000; // check every 6h

async function refreshDueLinkedInTokens() {
  const dueBefore = new Date(Date.now() + REFRESH_WINDOW_MS);

  const accounts = await prisma.socialAccount.findMany({
    where: {
      platform: "LINKEDIN",
      refreshTokenEnc: { not: null },
      tokenExpiresAt: { lt: dueBefore },
    },
  });

  for (const account of accounts) {
    const refreshToken = decryptRefreshToken(account);
    if (!refreshToken) continue;

    try {
      const refreshed = await refreshLinkedInAccessToken(refreshToken);
      await prisma.socialAccount.update({
        where: { id: account.id },
        data: {
          accessTokenEnc: encryptToken(refreshed.access_token),
          refreshTokenEnc: refreshed.refresh_token
            ? encryptToken(refreshed.refresh_token)
            : account.refreshTokenEnc,
          tokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
        },
      });
      console.log(`[token-refresh] Refreshed LinkedIn token for account ${account.id}`);
    } catch (error) {
      // Most commonly: the refresh token itself expired/was revoked. The
      // account's tokenExpiresAt stays as-is, which the Accounts UI will
      // surface as "Läuft bald ab" / "Abgelaufen" so the owner reconnects.
      console.error(`[token-refresh] Failed for account ${account.id}:`, error);
    }
  }
}

async function main() {
  const queue = new Queue(QUEUE_NAME, { connection: redis });
  await queue.upsertJobScheduler("token-refresh-repeat", { every: RUN_EVERY_MS });

  const worker = new Worker(
    QUEUE_NAME,
    async () => {
      await refreshDueLinkedInTokens();
    },
    { connection: redis },
  );

  worker.on("failed", (job, err) => {
    console.error(`[token-refresh] Job ${job?.id} failed:`, err);
  });

  console.log("[token-refresh] Worker started, checking every 6h.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
