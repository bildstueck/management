import { requireUser } from "@/lib/dal";
import { requireWorkspaceMember } from "@/lib/workspaces";
import { listMedia } from "@/lib/media";
import { MediaLibraryList } from "@/components/media-library-list";
import { deleteMediaAction } from "./actions";

export default async function MediaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const workspace = await requireWorkspaceMember(slug, user.id);
  const media = await listMedia(workspace.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Material</h1>
        <p className="text-muted-foreground">
          Alles, was hochgeladen wurde — vom Team und vom Kunden, mit Zeitpunkt.
        </p>
      </div>
      <MediaLibraryList media={media} onDelete={deleteMediaAction.bind(null, slug)} />
    </div>
  );
}
