import Link from "next/link";
import { requireUser } from "@/lib/dal";
import { requireWorkspaceMember } from "@/lib/workspaces";
import { listPosts } from "@/lib/posts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_META } from "@/components/platform-meta";
import { PostComments } from "@/components/post-comments";
import { isFutureDate } from "@/lib/calendar-dates";
import {
  deletePostAction,
  submitForApprovalAction,
  revertToDraftAction,
  schedulePostAction,
  publishNowAction,
  cancelScheduleAction,
} from "../actions";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Entwurf",
  PENDING_APPROVAL: "Wartet auf Freigabe",
  APPROVED: "Freigegeben",
  SCHEDULED: "Geplant",
  PUBLISHED: "Veröffentlicht",
  FAILED: "Fehlgeschlagen",
};

const UPCOMING_STATUSES = new Set(["DRAFT", "PENDING_APPROVAL", "APPROVED", "SCHEDULED", "FAILED"]);

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

type StatusFilter = "upcoming" | "published" | "all";

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "upcoming", label: "Anstehend" },
  { value: "published", label: "Veröffentlicht" },
  { value: "all", label: "Alle" },
];

export default async function FeedPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { slug } = await params;
  const { status: statusParam } = await searchParams;
  const activeFilter: StatusFilter =
    statusParam === "published" || statusParam === "all" ? statusParam : "upcoming";

  const user = await requireUser();
  const workspace = await requireWorkspaceMember(slug, user.id);
  const allPosts = await listPosts(workspace.id);

  const posts = allPosts.filter((post) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "published") return post.status === "PUBLISHED";
    return UPCOMING_STATUSES.has(post.status);
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1">
        {FILTERS.map((filter) => (
          <Button
            key={filter.value}
            size="sm"
            variant={activeFilter === filter.value ? "default" : "ghost"}
            render={
              <Link href={filter.value === "upcoming" ? `/w/${slug}/posts` : `/w/${slug}/posts?status=${filter.value}`} />
            }
          >
            {filter.label}
          </Button>
        ))}
      </div>

      {posts.length === 0 ? (
        <Card className="max-w-xl border-dashed shadow-none">
          <CardHeader>
            <CardTitle className="text-base font-medium text-muted-foreground">
              {activeFilter === "published" ? "Noch nichts veröffentlicht" : "Nichts hier"}
            </CardTitle>
          </CardHeader>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {posts.map((post) => {
            const latestJob = post.publishJobs[0];
            return (
              <Card key={post.id} className="shadow-none">
                <CardContent className="flex flex-col gap-3 py-3.5">
                  <div className="flex items-center justify-between gap-4">
                    <Link href={`/w/${slug}/posts/${post.id}`} className="flex-1">
                      <p className="line-clamp-2 text-sm">
                        {post.masterText || <span className="text-muted-foreground">(kein Text)</span>}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <Badge
                          variant={
                            post.status === "PUBLISHED"
                              ? "default"
                              : post.status === "FAILED"
                                ? "destructive"
                                : post.status === "APPROVED"
                                  ? "default"
                                  : "secondary"
                          }
                        >
                          {STATUS_LABELS[post.status]}
                        </Badge>
                        {post.scheduledAt && (
                          <span className="text-xs text-muted-foreground">
                            {dateFormatter.format(post.scheduledAt)}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          {post.channelVariants.map((variant) => {
                            const Icon = PLATFORM_META[variant.socialAccount.platform].icon;
                            return <Icon key={variant.id} className="size-3.5 text-muted-foreground" />;
                          })}
                        </span>
                      </div>
                      {post.status === "FAILED" && latestJob?.errorMessage && (
                        <p className="mt-1 text-xs text-destructive">{latestJob.errorMessage}</p>
                      )}
                    </Link>
                    <div className="flex items-center gap-1">
                      {post.status === "DRAFT" && (
                        <form action={submitForApprovalAction}>
                          <input type="hidden" name="slug" value={slug} />
                          <input type="hidden" name="postId" value={post.id} />
                          <Button type="submit" variant="outline" size="sm">
                            Zur Freigabe einreichen
                          </Button>
                        </form>
                      )}
                      {(post.status === "PENDING_APPROVAL" || post.status === "APPROVED") && (
                        <form action={revertToDraftAction}>
                          <input type="hidden" name="slug" value={slug} />
                          <input type="hidden" name="postId" value={post.id} />
                          <Button type="submit" variant="ghost" size="sm">
                            Zurück zu Entwurf
                          </Button>
                        </form>
                      )}
                      {(post.status === "APPROVED" || post.status === "FAILED") && (
                        <>
                          {post.scheduledAt && isFutureDate(post.scheduledAt) && (
                            <form action={schedulePostAction}>
                              <input type="hidden" name="slug" value={slug} />
                              <input type="hidden" name="postId" value={post.id} />
                              <Button type="submit" variant="outline" size="sm">
                                Terminieren
                              </Button>
                            </form>
                          )}
                          <form action={publishNowAction}>
                            <input type="hidden" name="slug" value={slug} />
                            <input type="hidden" name="postId" value={post.id} />
                            <Button type="submit" variant="default" size="sm">
                              {post.status === "FAILED" ? "Erneut versuchen" : "Jetzt veröffentlichen"}
                            </Button>
                          </form>
                        </>
                      )}
                      {post.status === "SCHEDULED" && (
                        <form action={cancelScheduleAction}>
                          <input type="hidden" name="slug" value={slug} />
                          <input type="hidden" name="postId" value={post.id} />
                          <Button type="submit" variant="ghost" size="sm">
                            Planung abbrechen
                          </Button>
                        </form>
                      )}
                      <form action={deletePostAction}>
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="postId" value={post.id} />
                        <Button type="submit" variant="ghost" size="sm">
                          Löschen
                        </Button>
                      </form>
                    </div>
                  </div>
                  <PostComments slug={slug} postId={post.id} initialComments={post.comments} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
