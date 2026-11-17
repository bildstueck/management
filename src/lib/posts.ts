import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { PostStatus } from "@prisma/client";

const COMMENTS_INCLUDE = {
  comments: { include: { authorUser: { select: { id: true, name: true, email: true } } } },
} as const;

const HISTORY_INCLUDE = {
  approvalEvents: {
    include: { actorUser: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" as const },
  },
} as const;

const LATEST_PUBLISH_JOB_INCLUDE = {
  publishJobs: { orderBy: { createdAt: "desc" as const }, take: 1 },
} as const;

export function listPosts(workspaceId: string) {
  return prisma.post.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
    include: {
      channelVariants: { include: { socialAccount: true } },
      ...COMMENTS_INCLUDE,
      ...HISTORY_INCLUDE,
      ...LATEST_PUBLISH_JOB_INCLUDE,
    },
  });
}

// Posts a client-facing share link may show: anything already submitted for
// review. Raw DRAFTs stay internal-only until a team member submits them.
const REVIEWABLE_STATUSES: PostStatus[] = ["PENDING_APPROVAL", "APPROVED", "SCHEDULED", "PUBLISHED"];

export function listReviewablePosts(workspaceId: string) {
  return prisma.post.findMany({
    where: { workspaceId, status: { in: REVIEWABLE_STATUSES } },
    orderBy: { updatedAt: "desc" },
    include: {
      channelVariants: { include: { socialAccount: true } },
      ...COMMENTS_INCLUDE,
      ...HISTORY_INCLUDE,
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

export async function postBelongsToWorkspace(workspaceId: string, postId: string): Promise<boolean> {
  const post = await prisma.post.findFirst({ where: { id: postId, workspaceId }, select: { id: true } });
  return post !== null;
}

// Lightweight lookup for places that just need to confirm a post belongs to
// a workspace and want its text for a notification — avoids the heavier
// getPost() (which also pulls channel variants and 404s via next/navigation,
// not appropriate for a public share-link action).
export function getPostLite(workspaceId: string, postId: string) {
  return prisma.post.findFirst({
    where: { id: postId, workspaceId },
    select: { id: true, masterText: true },
  });
}

export class PostActionError extends Error {}

type Actor = { userId?: string; name?: string };

async function transitionStatus(
  workspaceId: string,
  postId: string,
  from: PostStatus[],
  to: PostStatus,
  actor: Actor,
  note?: string,
) {
  return prisma.$transaction(async (tx) => {
    const post = await tx.post.findFirst({ where: { id: postId, workspaceId } });
    if (!post) notFound();
    if (!from.includes(post.status)) {
      throw new PostActionError(
        `Beitrag ist im Status "${post.status}" — Übergang nach "${to}" nicht möglich.`,
      );
    }

    const updated = await tx.post.update({ where: { id: post.id }, data: { status: to } });
    await tx.approvalEvent.create({
      data: {
        postId: post.id,
        action: "STATUS_CHANGED",
        fromStatus: post.status,
        toStatus: to,
        actorUserId: actor.userId,
        actorName: actor.name,
        note,
      },
    });
    return updated;
  });
}

// Internal team: send a draft to the client for review.
export function submitForApproval(workspaceId: string, postId: string, userId: string) {
  return transitionStatus(workspaceId, postId, ["DRAFT"], "PENDING_APPROVAL", { userId });
}

// Internal team: pull a post back out of review/approval for more edits.
export function revertToDraft(workspaceId: string, postId: string, userId: string) {
  return transitionStatus(
    workspaceId,
    postId,
    ["PENDING_APPROVAL", "APPROVED"],
    "DRAFT",
    { userId },
  );
}

// Client (via share link) or internal team: approve a post under review.
export function approvePost(workspaceId: string, postId: string, actor: Actor) {
  return transitionStatus(workspaceId, postId, ["PENDING_APPROVAL"], "APPROVED", actor);
}

// Client (via share link): send a post back to Entwurf with an optional
// reason, so the team sees it needs rework. Distinct from the team's own
// revertToDraft below only in who can call it and that it always logs a
// note — the Feed surfaces that note the same way it surfaces a FAILED
// publish error.
export function rejectPost(workspaceId: string, postId: string, actor: Actor, note?: string) {
  return transitionStatus(workspaceId, postId, ["PENDING_APPROVAL"], "DRAFT", actor, note);
}

// Internal team: queue an approved (or previously failed) post for
// publishing — immediately, or at its scheduledAt. The worker is what
// actually waits, via a delayed BullMQ job; this just flips status + logs
// the transition. Allowing FAILED → SCHEDULED directly is the "retry" path.
export function scheduleForPublish(workspaceId: string, postId: string, userId: string) {
  return transitionStatus(workspaceId, postId, ["APPROVED", "FAILED"], "SCHEDULED", { userId });
}

// Internal team: pull a queued post back before it publishes.
export function cancelSchedule(workspaceId: string, postId: string, userId: string) {
  return transitionStatus(workspaceId, postId, ["SCHEDULED"], "APPROVED", { userId });
}

// Worker-only: records one channel's successful publish so a retry (after a
// different channel failed) can skip it instead of posting twice.
export function markChannelPublished(variantId: string, externalPostId: string) {
  return prisma.postChannelVariant.update({
    where: { id: variantId },
    data: { publishedExternalId: externalPostId },
  });
}

// Worker-only: called after every channel succeeded. Not scoped to a
// workspace — the worker already loaded the post itself, there's no
// user-supplied workspaceId to check against here.
export async function markPostPublished(postId: string, channelCount: number) {
  await prisma.$transaction(async (tx) => {
    const post = await tx.post.update({
      where: { id: postId },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });
    await tx.approvalEvent.create({
      data: {
        postId: post.id,
        action: "STATUS_CHANGED",
        fromStatus: "SCHEDULED",
        toStatus: "PUBLISHED",
        note: `Veröffentlicht (${channelCount} Kanal/Kanäle).`,
      },
    });
  });
}

export async function markPostFailed(postId: string, errorSummary: string) {
  await prisma.$transaction(async (tx) => {
    const post = await tx.post.update({ where: { id: postId }, data: { status: "FAILED" } });
    await tx.approvalEvent.create({
      data: {
        postId: post.id,
        action: "STATUS_CHANGED",
        fromStatus: "SCHEDULED",
        toStatus: "FAILED",
        note: errorSummary,
      },
    });
  });
}

// Everything the publish worker needs for one post: channels with their
// SocialAccount (for tokens) and the post's own master media as a fallback.
export function getPostForPublishing(postId: string) {
  return prisma.post.findUnique({
    where: { id: postId },
    include: { channelVariants: { include: { socialAccount: true } } },
  });
}

// Client-facing text edit via a share link with canEdit. Logged as a simple
// version history entry (old → new) on ApprovalEvent rather than a separate
// versions table — see ApprovalEvent.action = EDITED.
export async function updatePostTextByReviewer(
  workspaceId: string,
  postId: string,
  newText: string,
  actorName: string,
) {
  return prisma.$transaction(async (tx) => {
    const post = await tx.post.findFirst({ where: { id: postId, workspaceId } });
    if (!post) notFound();

    const oldText = post.masterText ?? "";
    await tx.post.update({ where: { id: post.id }, data: { masterText: newText } });
    await tx.approvalEvent.create({
      data: {
        postId: post.id,
        action: "EDITED",
        actorName,
        note: `Text geändert:\n− ${oldText}\n+ ${newText}`,
      },
    });
  });
}
