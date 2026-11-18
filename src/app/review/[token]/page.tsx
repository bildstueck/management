import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { PostStatus } from "@prisma/client";
import { getShareLinkByToken } from "@/lib/share-links";
import { listPostsByStatus, listReviewablePostsInRange } from "@/lib/posts";
import { getMonthGrid } from "@/lib/calendar-dates";
import { Badge } from "@/components/ui/badge";
import { ReviewUpload } from "@/components/review/review-upload";
import { ReviewCalendar } from "@/components/review/review-calendar";

const STATUS_LABELS: Record<PostStatus, string> = {
  DRAFT: "Entwurf",
  PENDING_APPROVAL: "Wartet auf dich",
  APPROVED: "Freigegeben",
  SCHEDULED: "Geplant",
  PUBLISHED: "Veröffentlicht",
  FAILED: "Fehlgeschlagen",
};

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function PostList({
  token,
  posts,
  emptyLabel,
}: {
  token: string;
  posts: { id: string; masterText: string | null; status: PostStatus; scheduledAt: Date | null }[];
  emptyLabel: string;
}) {
  if (posts.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {posts.map((post) => (
        <Link
          key={post.id}
          href={`/review/${token}/posts#post-${post.id}`}
          className="flex items-center gap-3 rounded-lg border px-4 py-3 text-sm hover:border-primary"
        >
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 font-medium">
              {post.masterText || <span className="text-muted-foreground">(kein Text)</span>}
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {STATUS_LABELS[post.status]}
              </Badge>
              {post.scheduledAt && (
                <span className="text-xs text-muted-foreground">
                  {dateFormatter.format(post.scheduledAt)}
                </span>
              )}
            </div>
          </div>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      ))}
    </div>
  );
}

export default async function ReviewOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { token } = await params;
  const { month } = await searchParams;
  const link = await getShareLinkByToken(token);
  if (!link) return null; // handled by the layout

  const now = new Date();
  const [yearStr, monthStr] = (
    month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  ).split("-");
  const year = Number(yearStr) || now.getFullYear();
  const monthIndex = (Number(monthStr) || now.getMonth() + 1) - 1;
  const grid = getMonthGrid(year, monthIndex);

  const [pending, approved, calendarPosts] = await Promise.all([
    listPostsByStatus(link.workspaceId, ["PENDING_APPROVAL"]),
    listPostsByStatus(link.workspaceId, ["APPROVED", "SCHEDULED", "PUBLISHED"]),
    listReviewablePostsInRange(link.workspaceId, grid.gridStart, grid.gridEnd),
  ]);

  const greeting = link.recipientName ? `Hallo ${link.recipientName}` : "Hallo!";

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{greeting}</h1>
        <p className="text-muted-foreground">
          Verwalte hier alle Beiträge für die {link.workspace.name}.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-xl border bg-background p-4">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Wartet auf deine Freigabe ({pending.length})
          </h2>
          <PostList token={token} posts={pending} emptyLabel="Nichts wartet gerade auf dich." />
        </div>
        <div className="flex flex-col gap-3 rounded-xl border bg-background p-4">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Bereits freigegeben ({approved.length})
          </h2>
          <PostList token={token} posts={approved} emptyLabel="Noch nichts freigegeben." />
        </div>
      </div>

      {link.canUpload && <ReviewUpload token={token} />}

      <ReviewCalendar
        key={`${year}-${monthIndex}`}
        token={token}
        year={year}
        monthIndex={monthIndex}
        days={grid.days}
        posts={calendarPosts}
      />
    </div>
  );
}
