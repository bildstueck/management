import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PostsViewTabs } from "@/components/posts-view-tabs";

export default async function PostsViewsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <PostsViewTabs slug={slug} />
        <Button render={<Link href={`/w/${slug}/posts/new`} />}>Neuer Beitrag</Button>
      </div>
      {children}
    </div>
  );
}
