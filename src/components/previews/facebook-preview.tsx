import { ThumbsUp, MessageCircle, Share2, Globe } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PreviewFrame, MediaGrid } from "./preview-frame";
import { previewInitials, type PreviewProps } from "./types";

export function FacebookPreview({ accountName, avatarUrl, text, media, mode }: PreviewProps) {
  return (
    <PreviewFrame mode={mode}>
      <div className="flex items-center gap-2 p-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={avatarUrl ?? undefined} />
          <AvatarFallback>{previewInitials(accountName)}</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-semibold">{accountName}</p>
          <p className="flex items-center gap-1 text-xs text-black/50">
            Gerade eben · <Globe className="size-3" />
          </p>
        </div>
      </div>
      {text && <p className="px-3 pb-3 text-sm whitespace-pre-wrap">{text}</p>}
      <MediaGrid media={media} />
      <div className="flex items-center justify-between border-t px-3 py-1.5 text-xs text-black/60">
        <span>0 Gefällt mir</span>
        <span>0 Kommentare</span>
      </div>
      <div className="flex items-center justify-around border-t py-1 text-sm font-medium text-black/60">
        <span className="flex items-center gap-1.5 px-2 py-1">
          <ThumbsUp className="size-4" /> Gefällt mir
        </span>
        <span className="flex items-center gap-1.5 px-2 py-1">
          <MessageCircle className="size-4" /> Kommentieren
        </span>
        <span className="flex items-center gap-1.5 px-2 py-1">
          <Share2 className="size-4" /> Teilen
        </span>
      </div>
    </PreviewFrame>
  );
}
