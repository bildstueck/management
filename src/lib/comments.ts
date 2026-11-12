import "server-only";
import { prisma } from "@/lib/prisma";

export function listComments(postId: string) {
  return prisma.comment.findMany({
    where: { postId },
    include: { authorUser: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function addInternalComment(postId: string, userId: string, text: string) {
  return prisma.comment.create({
    data: { postId, authorType: "INTERNAL", authorUserId: userId, text },
    include: { authorUser: { select: { id: true, name: true, email: true } } },
  });
}

export async function addExternalComment(postId: string, authorName: string, text: string) {
  return prisma.comment.create({
    data: { postId, authorType: "EXTERNAL", authorName, text },
    include: { authorUser: { select: { id: true, name: true, email: true } } },
  });
}

export async function setCommentResolved(postId: string, commentId: string, resolved: boolean) {
  await prisma.comment.updateMany({ where: { id: commentId, postId }, data: { resolved } });
}
