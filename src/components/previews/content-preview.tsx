import type { PreviewMedia } from "./types";

function MediaCell({ item, overlay }: { item: PreviewMedia; overlay?: number }) {
  return (
    <div className="relative aspect-square overflow-hidden bg-black/5">
      {item.type === "VIDEO" ? (
        <video src={item.url} className="h-full w-full object-cover" muted />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.url} alt="" className="h-full w-full object-cover" />
      )}
      {overlay ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-lg font-semibold text-white">
          +{overlay}
        </div>
      ) : null}
    </div>
  );
}

// Plattform-neutral preview of a post's master text + media — used wherever
// there's no specific channel to mock up for (yet), so there's always
// something concrete to look at instead of an empty state.
export function ContentPreview({ text, media }: { text: string; media: PreviewMedia[] }) {
  const visible = media.slice(0, 4);
  const hiddenCount = media.length - visible.length;

  return (
    <div className="overflow-hidden rounded-xl border bg-background">
      {visible.length === 1 && <MediaCell item={visible[0]} />}
      {visible.length > 1 && (
        <div className="grid grid-cols-2 gap-px bg-border">
          {visible.map((item, i) => (
            <MediaCell
              key={item.id}
              item={item}
              overlay={i === visible.length - 1 && hiddenCount > 0 ? hiddenCount : undefined}
            />
          ))}
        </div>
      )}
      <div className="p-4">
        {text ? (
          <p className="text-sm whitespace-pre-wrap">{text}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">Kein Text</p>
        )}
      </div>
    </div>
  );
}
