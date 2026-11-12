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

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function FeedPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const workspace = await requireWorkspaceMember(slug, user.id);
  const posts = await listPosts(workspace.id);

  return posts.length === 0 ? (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Noch keine Beiträge</CardTitle>
      </CardHeader>
    </Card>
  ) : (
    <div className="flex flex-col gap-3">
      {posts.map((post) => {
        const latestJob = post.publishJobs[0];
        return (
          <Card key={post.id}>
            <CardContent className="flex flex-col gap-3 py-4">
              <div className="flex items-center justify-between gap-4">
                <Link href={`/w/${slug}/posts/${post.id}`} className="flex-1">
                  <p className="line-clamp-2 text-sm">
                    {post.masterText || <span className="text-muted-foreground">(kein Text)</span>}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
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
                    {post.channelVariants.map((variant) => {
                      const Icon = PLATFORM_META[variant.socialAccount.platform].icon;
                      return <Icon key={variant.id} className="size-4 text-muted-foreground" />;
                    })}
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
  );
}
