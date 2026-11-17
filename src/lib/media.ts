import { prisma } from "@/lib/prisma";
import type { MediaType } from "@prisma/client";

export function listMedia(workspaceId: string) {
  return prisma.media.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } });
}

export type CreateMediaInput = {
  workspaceId: string;
  type: MediaType;
  storageKey: string;
  url: string;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
};

export function createMedia(input: CreateMediaInput) {
  return prisma.media.create({ data: input });
}

export async function deleteMedia(workspaceId: string, mediaId: string) {
  await prisma.media.deleteMany({ where: { id: mediaId, workspaceId } });
}

export async function getMediaByIds(workspaceId: string, ids: string[]) {
  if (ids.length === 0) return [];
  const media = await prisma.media.findMany({ where: { workspaceId, id: { in: ids } } });
  // Preserve caller-requested order (Media.mediaIds arrays are ordered).
  const byId = new Map(media.map((m) => [m.id, m]));
  return ids.map((id) => byId.get(id)).filter((m): m is NonNullable<typeof m> => !!m);
}
