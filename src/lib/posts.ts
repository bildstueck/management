import "server-only";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export function listPosts(workspaceId: string) {
  return prisma.post.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
    include: {
      channelVariants: { include: { socialAccount: true } },
      comments: { include: { authorUser: { select: { id: true, name: true, email: true } } } },
    },
  });
}

export function listPostsInRange(workspaceId: string, from: Date, to: Date) {
  return prisma.post.findMany({
    where: { workspaceId, scheduledAt: { gte: from, lt: to } },
    orderBy: { scheduledAt: "asc" },
    include: { channelVariants: { include: { socialAccount: true } } },
  });
}

export function listUnscheduledPosts(workspaceId: string) {
  return prisma.post.findMany({
    where: { workspaceId, scheduledAt: null },
    orderBy: { createdAt: "desc" },
    include: { channelVariants: { include: { socialAccount: true } } },
  });
}

export async function reschedulePost(workspaceId: string, postId: string, scheduledAt: Date | null) {
  await prisma.post.updateMany({ where: { id: postId, workspaceId }, data: { scheduledAt } });
}

// For the Instagram grid preview: all IG channel variants in the workspace,
// most-recently-scheduled first. Posts without a scheduledAt have no defined
// position yet, so they sort to the end rather than relying on the
// database's (non-obvious) NULLS ordering default.
export async function listInstagramVariants(workspaceId: string, socialAccountId?: string) {
  const variants = await prisma.postChannelVariant.findMany({
    where: {
      socialAccount: { workspaceId, platform: "INSTAGRAM", ...(socialAccountId ? { id: socialAccountId } : {}) },
    },
    include: { post: true, socialAccount: true },
  });

  return variants.sort((a, b) => {
    const aTime = a.post.scheduledAt?.getTime();
    const bTime = b.post.scheduledAt?.getTime();
    if (aTime === undefined && bTime === undefined) {
      return b.post.createdAt.getTime() - a.post.createdAt.getTime();
    }
    if (aTime === undefined) return 1;
    if (bTime === undefined) return -1;
    return bTime - aTime;
  });
}

export async function getPost(workspaceId: string, postId: string) {
  const post = await prisma.post.findFirst({
    where: { id: postId, workspaceId },
    include: { channelVariants: { include: { socialAccount: true } } },
  });
  if (!post) notFound();
  return post;
}

export type ChannelVariantInput = {
  socialAccountId: string;
  text: string | null;
  mediaIds: string[];
};

export type SavePostInput = {
  postId?: string;
  masterText: string | null;
  masterMediaIds: string[];
  scheduledAt?: Date | null;
  channels: ChannelVariantInput[];
};

export async function savePost(workspaceId: string, userId: string, input: SavePostInput) {
  if (input.postId) {
    const existing = await prisma.post.findFirst({
      where: { id: input.postId, workspaceId },
      select: { id: true },
    });
    if (!existing) notFound();
  }

  return prisma.$transaction(async (tx) => {
    const post = input.postId
      ? await tx.post.update({
          where: { id: input.postId },
          data: {
            masterText: input.masterText,
            masterMediaIds: input.masterMediaIds,
            ...(input.scheduledAt !== undefined ? { scheduledAt: input.scheduledAt } : {}),
          },
        })
      : await tx.post.create({
          data: {
            workspaceId,
            createdById: userId,
            masterText: input.masterText,
            masterMediaIds: input.masterMediaIds,
            scheduledAt: input.scheduledAt ?? null,
          },
        });

    const keepAccountIds = input.channels.map((c) => c.socialAccountId);
    await tx.postChannelVariant.deleteMany({
      where: { postId: post.id, socialAccountId: { notIn: keepAccountIds } },
    });

    for (const channel of input.channels) {
      await tx.postChannelVariant.upsert({
        where: {
          postId_socialAccountId: { postId: post.id, socialAccountId: channel.socialAccountId },
        },
        create: {
          postId: post.id,
          socialAccountId: channel.socialAccountId,
          text: channel.text,
          mediaIds: channel.mediaIds,
        },
        update: {
          text: channel.text,
          mediaIds: channel.mediaIds,
        },
      });
    }

    return post;
  });
}

export async function deletePost(workspaceId: string, postId: string) {
  await prisma.post.deleteMany({ where: { id: postId, workspaceId } });
}
