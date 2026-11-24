export function PreviewFrame({
  mode,
  children,
}: {
  mode: "desktop" | "mobile";
  children: React.ReactNode;
}) {
  return (
    <div
      className="mx-auto overflow-hidden rounded-lg border bg-white text-black shadow-sm dark:bg-white dark:text-black"
      style={{ width: mode === "mobile" ? 375 : 500 }}
    >
      {children}
    </div>
  );
}

export function MediaGrid({ media }: { media: { id: string; type: "IMAGE" | "VIDEO"; url: string }[] }) {
  if (media.length === 0) return null;
  if (media.length === 1) {
    const item = media[0];
    return (
      <div className="bg-black/5">
        {item.type === "VIDEO" ? (
          <video src={item.url} className="max-h-96 w-full object-contain" controls />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.url} alt="" loading="lazy" decoding="async" className="max-h-96 w-full object-contain" />
        )}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-0.5 bg-black/5">
      {media.slice(0, 4).map((item) => (
        <div key={item.id} className="aspect-square overflow-hidden">
          {item.type === "VIDEO" ? (
            <video src={item.url} className="h-full w-full object-cover" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
          )}
        </div>
      ))}
    </div>
  );
}
