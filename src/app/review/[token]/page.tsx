import Image from "next/image";
import { getShareLinkByToken } from "@/lib/share-links";
import { isShareLinkUnlocked, getReviewerName } from "@/lib/share-link-session";
import { listReviewablePosts, listReviewablePostsInRange } from "@/lib/posts";
import { listMedia } from "@/lib/media";
import { getMonthGrid } from "@/lib/calendar-dates";
import { PasswordGate } from "@/components/review/password-gate";
import { ReviewPostCard } from "@/components/review/review-post-card";
import { ReviewUpload } from "@/components/review/review-upload";
import { ReviewCalendar } from "@/components/review/review-calendar";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { token } = await params;
  const { month } = await searchParams;
  const link = await getShareLinkByToken(token);

  if (!link) {
    return (
      <div className="flex min-h-full flex-1 flex-col">
        <header className="flex items-center border-b px-6 py-3">
          <Image
            src="/brand/bildstueck-mark.png"
            alt="bildstueck"
            width={689}
            height={416}
            priority
            className="h-6 w-auto"
          />
        </header>
        <div className="flex flex-1 items-center justify-center p-6 text-center">
          <div>
            <h1 className="text-xl font-semibold">Link ungültig oder abgelaufen</h1>
            <p className="mt-2 text-muted-foreground">
              Bitte frag die Agentur nach einem neuen Einladungslink.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (link.passwordHash && !(await isShareLinkUnlocked(link.id))) {
    return <PasswordGate token={token} />;
  }

  const now = new Date();
  const [yearStr, monthStr] = (
    month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  ).split("-");
  const year = Number(yearStr) || now.getFullYear();
  const monthIndex = (Number(monthStr) || now.getMonth() + 1) - 1;
  const grid = getMonthGrid(year, monthIndex);

  const [posts, media, reviewerName, calendarPosts] = await Promise.all([
    listReviewablePosts(link.workspaceId),
    listMedia(link.workspaceId),
    getReviewerName(),
    listReviewablePostsInRange(link.workspaceId, grid.gridStart, grid.gridEnd),
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

  const greeting = link.recipientName ? `Hallo ${link.recipientName}` : link.workspace.name;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <Image
          src="/brand/bildstueck-mark.png"
          alt="bildstueck"
          width={689}
          height={416}
          priority
          className="h-6 w-auto"
        />
        {link.recipientName && (
          <span className="text-sm text-muted-foreground">{link.recipientName}</span>
        )}
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold">{greeting}</h1>
          <p className="text-muted-foreground">Beiträge zur Freigabe.</p>
        </div>

        {others.length > 0 && (
          <div className="flex flex-col gap-2 rounded-xl border bg-background p-4">
            <h2 className="text-sm font-semibold text-muted-foreground">
              Bereits freigegeben ({others.length})
            </h2>
            <div className="flex flex-wrap gap-2">
              {others.map((post) => (
                <a
                  key={post.id}
                  href={`#post-${post.id}`}
                  className="max-w-full truncate rounded-full border px-3 py-1 text-sm hover:border-primary"
                >
                  {post.masterText?.slice(0, 40) || "(kein Text)"}
                </a>
              ))}
            </div>
          </div>
        )}

        {link.canUpload && <ReviewUpload token={token} />}

        <ReviewCalendar
          key={`${year}-${monthIndex}`}
          token={token}
          year={year}
          monthIndex={monthIndex}
          days={grid.days}
          posts={calendarPosts}
        />

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
      </main>
    </div>
  );
}
