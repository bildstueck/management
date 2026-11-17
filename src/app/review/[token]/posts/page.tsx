import { getShareLinkByToken } from "@/lib/share-links";
import { getReviewerName } from "@/lib/share-link-session";
import { listReviewablePosts } from "@/lib/posts";
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

  const [posts, media, reviewerName] = await Promise.all([
    listReviewablePosts(link.workspaceId),
    listMedia(link.workspaceId),
    getReviewerName(),
  ]);
  const mediaById = new Map(media.map((m) => [m.id, m]));
  const pending = posts.filter((p) => p.status === "PENDING_APPROVAL");
  const others = posts.filter((p) => p.status !== "PENDING_APPROVAL");
  const { canApprove, canEdit, canComment } = link;

  function renderCard(post: (typeof posts)[number]) {
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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Beiträge</h1>
        <p className="text-muted-foreground">Alle Beiträge, die zur Freigabe standen oder stehen.</p>
      </div>

      {posts.length === 0 ? (
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
              <div className="flex flex-col gap-4">{pending.map(renderCard)}</div>
            </div>
          )}
          {others.length > 0 && (
            <div className="flex flex-col gap-3">
              {pending.length > 0 && (
                <h2 className="text-sm font-semibold text-muted-foreground">Weitere Beiträge</h2>
              )}
              <div className="flex flex-col gap-4">{others.map(renderCard)}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
