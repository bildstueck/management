import { prisma } from "@/lib/prisma";
import { encryptToken, decryptToken } from "@/lib/encryption";
import type { Platform } from "@prisma/client";

export function listSocialAccounts(workspaceId: string) {
  return prisma.socialAccount.findMany({
    where: { workspaceId },
    orderBy: [{ platform: "asc" }, { displayName: "asc" }],
  });
}

export type UpsertSocialAccountInput = {
  workspaceId: string;
  platform: Platform;
  externalAccountId: string;
  displayName: string;
  avatarUrl?: string | null;
  accessToken: string;
  refreshToken?: string | null;
  tokenExpiresAt?: Date | null;
};

export function upsertSocialAccount(input: UpsertSocialAccountInput) {
  const { workspaceId, platform, externalAccountId, displayName, avatarUrl } = input;

  return prisma.socialAccount.upsert({
    where: {
      workspaceId_platform_externalAccountId: { workspaceId, platform, externalAccountId },
    },
    create: {
      workspaceId,
      platform,
      externalAccountId,
      displayName,
      avatarUrl,
      accessTokenEnc: encryptToken(input.accessToken),
      refreshTokenEnc: input.refreshToken ? encryptToken(input.refreshToken) : null,
      tokenExpiresAt: input.tokenExpiresAt ?? null,
    },
    update: {
      displayName,
      avatarUrl,
      accessTokenEnc: encryptToken(input.accessToken),
      refreshTokenEnc: input.refreshToken ? encryptToken(input.refreshToken) : null,
      tokenExpiresAt: input.tokenExpiresAt ?? null,
    },
  });
}

export async function disconnectSocialAccount(workspaceId: string, socialAccountId: string) {
  await prisma.socialAccount.deleteMany({ where: { id: socialAccountId, workspaceId } });
}

export function decryptAccessToken(account: { accessTokenEnc: string }) {
  return decryptToken(account.accessTokenEnc);
}

export function decryptRefreshToken(account: { refreshTokenEnc: string | null }) {
  return account.refreshTokenEnc ? decryptToken(account.refreshTokenEnc) : null;
}
