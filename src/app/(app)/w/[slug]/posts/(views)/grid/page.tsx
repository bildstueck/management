import { requireUser } from "@/lib/dal";
import { requireWorkspaceMember } from "@/lib/workspaces";
import { listSocialAccounts } from "@/lib/social-accounts";
import { listInstagramVariants } from "@/lib/posts";
import { listMedia } from "@/lib/media";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Video } from "lucide-react";

export default async function InstagramGridPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ account?: string }>;
}) {
  const { slug } = await params;
  const { account } = await searchParams;
  const user = await requireUser();
  const workspace = await requireWorkspaceMember(slug, user.id);

  const [igAccounts, media] = await Promise.all([
    listSocialAccounts(workspace.id).then((accounts) =>
      accounts.filter((a) => a.platform === "INSTAGRAM"),
    ),
    listMedia(workspace.id),
  ]);

  if (igAccounts.length === 0) {
    return (
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Kein Instagram-Account verbunden</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground">
          Verbinde einen Instagram-Business-Account im Accounts-Tab, um die Grid-Vorschau zu sehen.
        </CardContent>
      </Card>
    );
  }

  const selectedAccountId = account && igAccounts.some((a) => a.id === account) ? account : igAccounts[0].id;
  const variants = await listInstagramVariants(workspace.id, selectedAccountId);
  const mediaById = new Map(media.map((m) => [m.id, m]));

  return (
    <div className="flex flex-col gap-4">
      {igAccounts.length > 1 && (
        <div className="flex gap-2">
          {igAccounts.map((a) => (
            <a
              key={a.id}
              href={`?account=${a.id}`}
              className={
                a.id === selectedAccountId
                  ? "rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
                  : "rounded-md border px-3 py-1.5 text-sm"
              }
            >
              {a.displayName}
            </a>
          ))}
        </div>
      )}

      {variants.length === 0 ? (
        <p className="text-muted-foreground">Noch keine Instagram-Beiträge geplant.</p>
      ) : (
        <div className="grid max-w-xl grid-cols-3 gap-1">
          {variants.map((variant) => {
            const mediaIds = variant.mediaIds.length > 0 ? variant.mediaIds : variant.post.masterMediaIds;
            const first = mediaById.get(mediaIds[0]);
            return (
              <div key={variant.id} className="relative aspect-square overflow-hidden bg-muted">
                {first?.type === "VIDEO" ? (
                  <div className="flex h-full w-full items-center justify-center">
                    <Video className="size-6 text-muted-foreground" />
                  </div>
                ) : first ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={first.url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                    Kein Medium
                  </div>
                )}
                {mediaIds.length > 1 && (
                  <span className="absolute top-1 right-1 rounded bg-black/60 px-1 text-[10px] text-white">
                    {mediaIds.length}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
