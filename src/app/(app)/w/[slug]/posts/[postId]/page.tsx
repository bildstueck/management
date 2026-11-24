import { requireUser } from "@/lib/dal";
import { requireWorkspaceMember } from "@/lib/workspaces";
import { listSocialAccounts } from "@/lib/social-accounts";
import { listMedia } from "@/lib/media";
import { getPost } from "@/lib/posts";
import { toDateKey } from "@/lib/calendar-dates";
import { PostComposer } from "@/components/post-composer";

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ slug: string; postId: string }>;
}) {
  const { slug, postId } = await params;
  const user = await requireUser();
  const workspace = await requireWorkspaceMember(slug, user.id);
  const [accounts, media, post] = await Promise.all([
    listSocialAccounts(workspace.id),
    listMedia(workspace.id),
    getPost(workspace.id, postId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Beitrag bearbeiten</h1>
      <PostComposer
        slug={slug}
        workspaceName={workspace.name}
        accounts={accounts}
        initialMedia={media.map((m) => ({ id: m.id, type: m.type, url: m.url }))}
        initialPost={{
          id: post.id,
          masterText: post.masterText ?? "",
          masterMediaIds: post.masterMediaIds,
          scheduledAt: post.scheduledAt ? toDateKey(post.scheduledAt) : null,
          channels: post.channelVariants.map((variant) => ({
            socialAccountId: variant.socialAccountId,
            text: variant.text,
            mediaIds: variant.mediaIds,
          })),
        }}
      />
    </div>
  );
}
