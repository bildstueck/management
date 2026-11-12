import "server-only";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import type { MembershipRole } from "@prisma/client";

export function getWorkspacesForUser(userId: string) {
  return prisma.workspace.findMany({
    where: { memberships: { some: { userId } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function createWorkspace(userId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Name darf nicht leer sein.");
  }

  const base = slugify(trimmed) || "workspace";
  let slug = base;
  for (let attempt = 0; await prisma.workspace.findUnique({ where: { slug } }); attempt++) {
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    if (attempt > 10) throw new Error("Konnte keinen eindeutigen Slug erzeugen.");
  }

  return prisma.workspace.create({
    data: {
      name: trimmed,
      slug,
      memberships: {
        create: { userId, role: "OWNER" },
      },
    },
  });
}

// Returns the workspace + the current user's membership, or null if the
// workspace doesn't exist or the user isn't a member of it. Callers that
// need a hard 404 should use requireWorkspaceMember instead.
export async function getWorkspaceForMember(slug: string, userId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { slug },
    include: { memberships: { where: { userId } } },
  });
  if (!workspace || workspace.memberships.length === 0) return null;

  const { memberships, ...rest } = workspace;
  return { ...rest, role: memberships[0].role };
}

// Same response (404) whether the workspace doesn't exist or the user just
// isn't a member — this avoids leaking which workspace slugs exist.
export async function requireWorkspaceMember(slug: string, userId: string) {
  const workspace = await getWorkspaceForMember(slug, userId);
  if (!workspace) notFound();
  return workspace;
}

export async function requireWorkspaceRole(
  slug: string,
  userId: string,
  roles: MembershipRole[],
) {
  const workspace = await requireWorkspaceMember(slug, userId);
  if (!roles.includes(workspace.role)) notFound();
  return workspace;
}
