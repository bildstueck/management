import "server-only";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export function listPosts(workspaceId: string) {
  return prisma.post.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
    include: { channelVariants: { include: { socialAccount: true } } },
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
          data: { masterText: input.masterText, masterMediaIds: input.masterMediaIds },
        })
      : await tx.post.create({
          data: {
            workspaceId,
            createdById: userId,
            masterText: input.masterText,
            masterMediaIds: input.masterMediaIds,
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
