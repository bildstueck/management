import { getShareLinkByToken } from "@/lib/share-links";
import { getReviewerName } from "@/lib/share-link-session";
import { listReviewablePosts, listRejectedPosts, sortBySoonest } from "@/lib/posts";
import { listMedia } from "@/lib/media";
import { ReviewPostCard } from "@/components/review/review-post-card";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ReviewPostsPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const link = await getShareLinkByToken(token);
  if (!link) return null; // handled by the layout

  const [reviewable, rejected, media, reviewerName] = await Promise.all([
    listReviewablePosts(link.workspaceId),
    listRejectedPosts(link.workspaceId),
    listMedia(link.workspaceId),
    getReviewerName(),
  ]);
  const mediaById = new Map(media.map((m) => [m.id, m]));
  const pending = sortBySoonest(reviewable.filter((p) => p.status === "PENDING_APPROVAL"));
  const decided = [...reviewable.filter((p) => p.status !== "PENDING_APPROVAL"), ...rejected].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
  );
  const { canApprove, canEdit, canComment } = link;

  function renderCard(post: (typeof pending)[number] | (typeof decided)[number], compact = false) {
    const isRejected = post.status === "DRAFT";
    const lastEvent = post.approvalEvents[post.approvalEvents.length - 1];
    return (
      <ReviewPostCard
        key={post.id}
        token={token}
        postId={post.id}
        status={post.status}
        masterText={post.masterText ?? ""}
        scheduledAt={post.scheduledAt}
        masterMedia={post.masterMediaIds
          .map((id) => mediaById.get(id))
          .filter((m): m is NonNullable<typeof m> => !!m)
          .map((m) => ({ id: m.id, type: m.type, url: m.url }))}
        canApprove={canApprove}
        canEdit={canEdit}
        canComment={canComment}
        reviewerName={reviewerName}
        comments={post.comments}
        history={post.approvalEvents}
        compact={compact}
        approvedAt={compact && !isRejected ? post.updatedAt : undefined}
        rejectedAt={compact && isRejected ? (lastEvent?.createdAt ?? post.updatedAt) : undefined}
        rejectionNote={compact && isRejected ? lastEvent?.note : undefined}
        channels={post.channelVariants.map((variant) => {
          const mediaIds = variant.mediaIds.length > 0 ? variant.mediaIds : post.masterMediaIds;
          return {
            id: variant.id,
            platform: variant.socialAccount.platform,
            accountName: variant.socialAccount.displayName,
            avatarUrl: variant.socialAccount.avatarUrl,
            text: variant.text ?? post.masterText,
            media: mediaIds
              .map((id) => mediaById.get(id))
              .filter((m): m is NonNullable<typeof m> => !!m)
              .map((m) => ({ id: m.id, type: m.type, url: m.url })),
          };
        })}
      />
    );
  }

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Beiträge</h1>
        <p className="text-muted-foreground">Alle Beiträge, die zur Freigabe standen oder stehen.</p>
      </div>

      {pending.length === 0 && decided.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Noch keine Beiträge zur Freigabe</CardTitle>
          </CardHeader>
        </Card>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-muted-foreground">
                Wartet auf deine Freigabe ({pending.length})
              </h2>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {pending.map((post) => renderCard(post))}
              </div>
            </div>
          )}
          {decided.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-muted-foreground">
                Bereits freigegeben/abgelehnt ({decided.length})
              </h2>
              <div className="flex max-w-xl flex-col gap-3">
                {decided.map((post) => renderCard(post, true))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
