import type { MediaType } from "@prisma/client";
import { relativeTime } from "@/lib/relative-time";

type MediaItem = { id: string; url: string; type: MediaType; createdAt: Date };

// Shared by the admin "Material" page and the client-facing one — just a
// read-only grid of everything uploaded to the workspace, newest first, so
// both sides can see what came in and when without digging through posts.
export function MediaLibraryList({ media }: { media: MediaItem[] }) {
  if (media.length === 0) {
    return <p className="text-sm text-muted-foreground">Noch nichts hochgeladen.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {media.map((item) => (
        <div key={item.id} className="overflow-hidden rounded-lg border bg-background">
          <div className="relative aspect-square bg-black/5">
            {item.type === "VIDEO" ? (
              <video src={item.url} className="h-full w-full object-cover" muted />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.url} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <p className="px-2 py-1.5 text-xs text-muted-foreground">{relativeTime(item.createdAt)}</p>
        </div>
      ))}
    </div>
  );
}
