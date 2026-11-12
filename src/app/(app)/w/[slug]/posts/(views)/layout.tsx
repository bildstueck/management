import Link from "next/link";
import { requireUser } from "@/lib/dal";
import { requireWorkspaceMember } from "@/lib/workspaces";
import { listSocialAccounts } from "@/lib/social-accounts";
import { Button } from "@/components/ui/button";
import { PostsViewTabs } from "@/components/posts-view-tabs";
import { ChannelsStrip } from "@/components/channels-strip";

export default async function PostsViewsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireUser();
  const workspace = await requireWorkspaceMember(slug, user.id);
  const accounts = await listSocialAccounts(workspace.id);

  return (
    <div className="flex flex-col gap-4">
      <ChannelsStrip slug={slug} accounts={accounts} />
      <div className="flex items-center justify-between">
        <PostsViewTabs slug={slug} />
        <Button render={<Link href={`/w/${slug}/posts/new`} />}>Neuer Beitrag</Button>
      </div>
      {children}
    </div>
  );
}
