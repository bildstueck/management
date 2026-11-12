import { getShareLinkByToken } from "@/lib/share-links";
import { isShareLinkUnlocked, getReviewerName } from "@/lib/share-link-session";
import { listReviewablePosts } from "@/lib/posts";
import { listMedia } from "@/lib/media";
import { PasswordGate } from "@/components/review/password-gate";
import { ReviewPostCard } from "@/components/review/review-post-card";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const link = await getShareLinkByToken(token);

  if (!link) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-center">
        <div>
          <h1 className="text-xl font-semibold">Link ungültig oder abgelaufen</h1>
          <p className="mt-2 text-muted-foreground">
            Bitte frag die Agentur nach einem neuen Freigabe-Link.
          </p>
        </div>
      </div>
    );
  }

  if (link.passwordHash && !(await isShareLinkUnlocked(link.id))) {
    return <PasswordGate token={token} />;
  }

  const [posts, media, reviewerName] = await Promise.all([
    listReviewablePosts(link.workspaceId),
    listMedia(link.workspaceId),
    getReviewerName(),
  ]);
  const mediaById = new Map(media.map((m) => [m.id, m]));

  return (
    <div className="mx-auto flex max-w-2xl flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">{link.workspace.name}</h1>
        <p className="text-muted-foreground">Beiträge zur Freigabe.</p>
      </div>

      {posts.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Noch keine Beiträge zur Freigabe</CardTitle>
          </CardHeader>
        </Card>
      ) : (
        posts.map((post) => (
          <ReviewPostCard
            key={post.id}
            token={token}
            postId={post.id}
            status={post.status}
            masterText={post.masterText ?? ""}
            canApprove={link.canApprove}
            canEdit={link.canEdit}
            canComment={link.canComment}
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
        ))
      )}
    </div>
  );
}
