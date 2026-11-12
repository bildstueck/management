import { requireUser } from "@/lib/dal";
import { requireWorkspaceMember } from "@/lib/workspaces";
import { listSocialAccounts } from "@/lib/social-accounts";
import { listMedia } from "@/lib/media";
import { PostComposer } from "@/components/post-composer";

export default async function NewPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const workspace = await requireWorkspaceMember(slug, user.id);
  const [accounts, media] = await Promise.all([
    listSocialAccounts(workspace.id),
    listMedia(workspace.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Neuer Beitrag</h1>
      <PostComposer
        slug={slug}
        accounts={accounts}
        initialMedia={media.map((m) => ({ id: m.id, type: m.type, url: m.url }))}
        initialPost={null}
      />
    </div>
  );
}
