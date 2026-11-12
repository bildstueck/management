import Link from "next/link";
import { requireUser } from "@/lib/dal";
import { requireWorkspaceMember } from "@/lib/workspaces";
import { listPosts } from "@/lib/posts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_META } from "@/components/platform-meta";
import { deletePostAction } from "./actions";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Entwurf",
  PENDING_APPROVAL: "Wartet auf Freigabe",
  APPROVED: "Freigegeben",
  SCHEDULED: "Geplant",
  PUBLISHED: "Veröffentlicht",
  FAILED: "Fehlgeschlagen",
};

export default async function PostsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const workspace = await requireWorkspaceMember(slug, user.id);
  const posts = await listPosts(workspace.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Beiträge</h1>
          <p className="text-muted-foreground">Entwürfe erstellen und bearbeiten.</p>
        </div>
        <Button render={<Link href={`/w/${slug}/posts/new`} />}>Neuer Beitrag</Button>
      </div>

      {posts.length === 0 ? (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Noch keine Beiträge</CardTitle>
          </CardHeader>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {posts.map((post) => (
            <Card key={post.id}>
              <CardContent className="flex items-center justify-between gap-4 py-4">
                <Link href={`/w/${slug}/posts/${post.id}`} className="flex-1">
                  <p className="line-clamp-2 text-sm">
                    {post.masterText || <span className="text-muted-foreground">(kein Text)</span>}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="secondary">{STATUS_LABELS[post.status]}</Badge>
                    {post.channelVariants.map((variant) => {
                      const Icon = PLATFORM_META[variant.socialAccount.platform].icon;
                      return <Icon key={variant.id} className="size-4 text-muted-foreground" />;
                    })}
                  </div>
                </Link>
                <form action={deletePostAction}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="postId" value={post.id} />
                  <Button type="submit" variant="ghost" size="sm">
                    Löschen
                  </Button>
                </form>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
