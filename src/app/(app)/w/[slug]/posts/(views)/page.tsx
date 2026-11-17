import Link from "next/link";
import { requireUser } from "@/lib/dal";
import { requireWorkspaceMember } from "@/lib/workspaces";
import { listPosts } from "@/lib/posts";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedPostRow } from "@/components/feed-post-row";

const UPCOMING_STATUSES = new Set(["DRAFT", "PENDING_APPROVAL", "APPROVED", "SCHEDULED", "FAILED"]);

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
            const lastEvent = post.approvalEvents[post.approvalEvents.length - 1];
            const rejectionNote =
              post.status === "DRAFT" && lastEvent?.toStatus === "DRAFT" && lastEvent?.note
                ? lastEvent.note
                : null;
            return (
              <FeedPostRow
                key={post.id}
                slug={slug}
                post={{
                  id: post.id,
                  masterText: post.masterText,
                  status: post.status,
                  scheduledAt: post.scheduledAt,
                  channelVariants: post.channelVariants,
                  comments: post.comments,
                  latestJobError: post.publishJobs[0]?.errorMessage ?? null,
                  rejectionNote,
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
