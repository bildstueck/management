import "server-only";
import {
  getPostForPublishing,
  markPostPublished,
  markPostFailed,
  markChannelPublished,
} from "@/lib/posts";
import { listMedia } from "@/lib/media";
import { decryptAccessToken } from "@/lib/social-accounts";
import {
  createRunningPublishJob,
  markPublishJobSucceeded,
  markPublishJobFailed,
} from "@/lib/publish-jobs";
import { publishToChannel, type PublishMedia } from "@/lib/publishers";

export type PublishOutcome =
  | { status: "published" }
  | { status: "failed"; detail: string }
  | { status: "skipped"; detail: string };

// Publishes one SCHEDULED post to every channel that hasn't already
// succeeded (PostChannelVariant.publishedExternalId) — so calling this
// again on a partially-failed post only retries what's left, instead of
// posting the already-succeeded channels twice.
//
// Single attempt, no built-in retry loop: there's no job queue behind this
// anymore (see /api/cron/publish and publishNowAction, the two callers). A
// failed post just stays retryable from the Feed ("Erneut versuchen" calls
// publishNowAction, which calls this again).
export async function publishPost(postId: string): Promise<PublishOutcome> {
  const post = await getPostForPublishing(postId);
  if (!post) return { status: "skipped", detail: "Beitrag existiert nicht mehr." };
  if (post.status !== "SCHEDULED") {
    return { status: "skipped", detail: `Status ist ${post.status}, nicht SCHEDULED.` };
  }

  const job = await createRunningPublishJob(postId);
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
      failures.push(
        `${variant.socialAccount.platform} (${variant.socialAccount.displayName}): ${result.error}`,
      );
    }
  }

  if (failures.length === 0) {
    await markPublishJobSucceeded(job.id);
    await markPostPublished(postId, post.channelVariants.length);
    return { status: "published" };
  }

  const errorSummary = failures.join("; ");
  await markPublishJobFailed(job.id, errorSummary);
  await markPostFailed(postId, errorSummary);
  return { status: "failed", detail: errorSummary };
}
