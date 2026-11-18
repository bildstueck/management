import { getShareLinkByToken } from "@/lib/share-links";
import { listMedia } from "@/lib/media";
import { MediaLibraryList } from "@/components/media-library-list";

export default async function ReviewMediaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const link = await getShareLinkByToken(token);
  if (!link) return null; // handled by the layout

  const media = await listMedia(link.workspaceId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Material</h1>
        <p className="text-muted-foreground">
          Alles, was du und die Agentur hochgeladen habt, mit Zeitpunkt.
        </p>
      </div>
      <MediaLibraryList media={media} />
    </div>
  );
}
