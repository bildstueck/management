import "server-only";
import { prisma } from "@/lib/prisma";
import type { MembershipRole } from "@prisma/client";

export function listMembers(workspaceId: string) {
  return prisma.membership.findMany({
    where: { workspaceId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export class MemberActionError extends Error {}

export async function addMemberByEmail(
  workspaceId: string,
  email: string,
  role: MembershipRole,
) {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) {
    throw new MemberActionError(
      "Kein Team-Account mit dieser E-Mail gefunden. Der Nutzer muss vorher angelegt werden.",
    );
  }

  const existing = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId } },
  });
  if (existing) {
    throw new MemberActionError("Dieser Nutzer ist bereits Mitglied des Workspaces.");
  }

  return prisma.membership.create({ data: { userId: user.id, workspaceId, role } });
}

async function assertNotLastOwner(workspaceId: string, membershipId: string) {
  const membership = await prisma.membership.findUnique({ where: { id: membershipId } });
  if (!membership || membership.workspaceId !== workspaceId) {
    throw new MemberActionError("Mitgliedschaft nicht gefunden.");
  }
  if (membership.role === "OWNER") {
    const ownerCount = await prisma.membership.count({
      where: { workspaceId, role: "OWNER" },
    });
    if (ownerCount <= 1) {
      throw new MemberActionError("Der letzte Owner kann nicht entfernt werden.");
    }
  }
  return membership;
}

export async function removeMember(workspaceId: string, membershipId: string) {
  await assertNotLastOwner(workspaceId, membershipId);
  await prisma.membership.delete({ where: { id: membershipId } });
}

export async function updateMemberRole(
  workspaceId: string,
  membershipId: string,
  role: MembershipRole,
) {
  // Throws if this would strip the workspace's last OWNER.
  await assertNotLastOwner(workspaceId, membershipId);
  await prisma.membership.update({ where: { id: membershipId }, data: { role } });
}
