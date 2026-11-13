import "server-only";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export function listShareLinks(workspaceId: string) {
  return prisma.shareLink.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } });
}

export type CreateShareLinkInput = {
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
