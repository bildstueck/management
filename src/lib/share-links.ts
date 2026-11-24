import "server-only";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export function listShareLinks(workspaceId: string) {
  return prisma.shareLink.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } });
}

export type CreateShareLinkInput = {
  recipientName?: string | null;
  password?: string | null;
  expiresAt?: Date | null;
  canComment: boolean;
  canApprove: boolean;
  canEdit: boolean;
  canUpload: boolean;
};

export async function createShareLink(workspaceId: string, input: CreateShareLinkInput) {
  const token = randomBytes(24).toString("base64url");
  const passwordHash = input.password ? await bcrypt.hash(input.password, 10) : null;

  return prisma.shareLink.create({
    data: {
      workspaceId,
      token,
      recipientName: input.recipientName || null,
      passwordHash,
      expiresAt: input.expiresAt ?? null,
      canComment: input.canComment,
      canApprove: input.canApprove,
      canEdit: input.canEdit,
      canUpload: input.canUpload,
    },
  });
}

export async function deleteShareLink(workspaceId: string, id: string) {
  await prisma.shareLink.deleteMany({ where: { id, workspaceId } });
}

export type UpdateShareLinkInput = Partial<{
  recipientName: string | null;
  canComment: boolean;
  canApprove: boolean;
  canEdit: boolean;
  canUpload: boolean;
}>;

export async function updateShareLink(workspaceId: string, id: string, input: UpdateShareLinkInput) {
  await prisma.shareLink.updateMany({ where: { id, workspaceId }, data: input });
}

// Returns null for a token that doesn't exist OR has expired — same
// response either way, so a guess can't distinguish "wrong" from "expired".
export async function getShareLinkByToken(token: string) {
  const link = await prisma.shareLink.findUnique({ where: { token }, include: { workspace: true } });
  if (!link) return null;
  if (link.expiresAt && link.expiresAt.getTime() < Date.now()) return null;
  return link;
}

export function verifyShareLinkPassword(link: { passwordHash: string | null }, password: string) {
  if (!link.passwordHash) return Promise.resolve(true);
  return bcrypt.compare(password, link.passwordHash);
}

// Basic brute-force protection on the password-gate: 5 wrong guesses locks
// the link out for 15 minutes. Scoped per share link (not per IP), which is
// enough here since the token itself is already an unguessable secret — this
// just stops someone who has the link from grinding through password guesses.
const MAX_PASSWORD_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

export function isShareLinkLockedOut(link: { lockedUntil: Date | null }): boolean {
  return !!link.lockedUntil && link.lockedUntil.getTime() > Date.now();
}

export async function recordFailedShareLinkAttempt(id: string) {
  const link = await prisma.shareLink.findUnique({ where: { id }, select: { failedAttempts: true } });
  if (!link) return;
  const attempts = link.failedAttempts + 1;
  await prisma.shareLink.update({
    where: { id },
    data:
      attempts >= MAX_PASSWORD_ATTEMPTS
        ? { failedAttempts: 0, lockedUntil: new Date(Date.now() + LOCKOUT_MS) }
        : { failedAttempts: attempts },
  });
}

export async function clearShareLinkAttempts(id: string) {
  await prisma.shareLink.update({ where: { id }, data: { failedAttempts: 0, lockedUntil: null } });
}
