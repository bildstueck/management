import type { PreviewMedia } from "./types";

function MediaCell({
  item,
  overlay,
  compact,
  fit = "cover",
}: {
  item: PreviewMedia;
  overlay?: number;
  compact?: boolean;
  // "contain" shows the whole image letterboxed instead of cropping it —
  // used for the single-image case, where cropping was hiding real content
  // (e.g. a logo graphic along one edge of the photo).
  fit?: "cover" | "contain";
}) {
  const fitClass = fit === "contain" ? "object-contain" : "object-cover";
  return (
    <div
      className={`relative overflow-hidden bg-black/5 ${compact ? "h-36" : "aspect-square"}`}
    >
      {item.type === "VIDEO" ? (
        <video src={item.url} className={`h-full w-full ${fitClass}`} muted />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.url}
          alt=""
          loading="lazy"
          decoding="async"
          className={`h-full w-full ${fitClass}`}
        />
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
// something concrete to look at instead of an empty state. `compact` caps
// the media height instead of letting it scale to the full column width —
// used on the client review feed, where cards sit in a narrow column and a
// square crop at full width still ends up very tall.
export function ContentPreview({
  text,
  media,
  compact,
}: {
  text: string;
  media: PreviewMedia[];
  compact?: boolean;
}) {
  const visible = media.slice(0, 4);
  const hiddenCount = media.length - visible.length;

  return (
    <div className="overflow-hidden rounded-xl border bg-background">
      {visible.length === 1 && <MediaCell item={visible[0]} compact={compact} fit="contain" />}
      {visible.length > 1 && (
        <div className="grid grid-cols-2 gap-px bg-border">
          {visible.map((item, i) => (
            <MediaCell
              key={item.id}
              item={item}
              compact={compact}
              overlay={i === visible.length - 1 && hiddenCount > 0 ? hiddenCount : undefined}
            />
          ))}
        </div>
      )}
      <div className="p-3">
        {text ? (
          <p className="text-sm whitespace-pre-wrap">{text}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">Kein Text</p>
        )}
      </div>
    </div>
  );
}
