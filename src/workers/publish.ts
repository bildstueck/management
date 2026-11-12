import "dotenv/config";
import { Worker, type Job } from "bullmq";
import { redis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { PUBLISH_QUEUE_NAME, type PublishPostJobData } from "@/lib/queue";
import { getPostForPublishing, markPostPublished, markPostFailed, markChannelPublished } from "@/lib/posts";
import { listMedia } from "@/lib/media";
import { decryptAccessToken } from "@/lib/social-accounts";
import { markPublishJobRunning, markPublishJobSucceeded, markPublishJobFailed } from "@/lib/publish-jobs";
import { publishToChannel, type PublishMedia } from "@/lib/publishers";

// Processes one "publish-post" job: fans out to every channel on the post.
//
// Retry note: BullMQ retries the whole job on failure, which re-runs every
// channel — except ones that already succeeded. Each PostChannelVariant
// records its own `publishedExternalId` the moment it succeeds, so a retry
// (triggered by a different channel failing) skips those instead of
// posting twice. There's no cross-platform transaction here: a post can end
// up "published" on some channels and "failed" on others after all retries
// are exhausted — that's reflected in FAILED's error message and each
// variant's publishedExternalId, not hidden.
async function processJob(job: Job<PublishPostJobData>) {
  const { postId } = job.data;

  const post = await getPostForPublishing(postId);
  if (!post) {
    console.warn(`[publish] Post ${postId} no longer exists, skipping.`);
    return;
  }
  if (post.status !== "SCHEDULED") {
    console.warn(`[publish] Post ${postId} is ${post.status}, not SCHEDULED — skipping (likely reverted).`);
    return;
  }

  const publishJob = await prisma.publishJob.findFirst({
    where: { postId, status: { in: ["QUEUED", "RUNNING"] } },
    orderBy: { createdAt: "desc" },
  });
  if (publishJob?.status === "QUEUED") await markPublishJobRunning(publishJob.id);

  const media = await listMedia(post.workspaceId);
  const mediaById = new Map(media.map((m) => [m.id, m]));

  const pendingVariants = post.channelVariants.filter((v) => !v.publishedExternalId);
  const failures: string[] = [];

  for (const variant of pendingVariants) {
    const mediaIds = variant.mediaIds.length > 0 ? variant.mediaIds : post.masterMediaIds;
    const resolvedMedia: PublishMedia[] = mediaIds
      .map((id) => mediaById.get(id))
      .filter((m): m is NonNullable<typeof m> => !!m)
      .map((m) => ({ type: m.type, url: m.url }));

    const accessToken = decryptAccessToken(variant.socialAccount);
    const result = await publishToChannel(variant.socialAccount.platform, {
      accessToken,
      externalAccountId: variant.socialAccount.externalAccountId,
      text: variant.text ?? post.masterText ?? "",
      media: resolvedMedia,
    });

    if (result.success) {
      await markChannelPublished(variant.id, result.externalPostId);
    } else {
      failures.push(`${variant.socialAccount.platform} (${variant.socialAccount.displayName}): ${result.error}`);
    }
  }

  if (failures.length === 0) {
    if (publishJob) await markPublishJobSucceeded(publishJob.id);
    await markPostPublished(postId, post.channelVariants.length);
    return;
  }

  const errorSummary = failures.join("; ");
  const maxAttempts = job.opts.attempts ?? 1;
  const isLastAttempt = job.attemptsMade + 1 >= maxAttempts;

  if (isLastAttempt) {
    if (publishJob) await markPublishJobFailed(publishJob.id, errorSummary);
    await markPostFailed(postId, errorSummary);
  }

  // Throwing lets BullMQ retry (or mark the job itself failed, on the last
  // attempt) — the DB side above already reflects the outcome either way.
  throw new Error(errorSummary);
}

function main() {
  const worker = new Worker<PublishPostJobData>(PUBLISH_QUEUE_NAME, processJob, {
    connection: redis,
    concurrency: 5,
  });

  worker.on("failed", (job, err) => {
    console.error(`[publish] Job ${job?.id} (post ${job?.data.postId}) failed:`, err.message);
  });
  worker.on("completed", (job) => {
    console.log(`[publish] Job ${job.id} (post ${job.data.postId}) completed.`);
  });

  console.log("[publish] Worker started.");
}

main();
