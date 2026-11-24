import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PreviewFrame } from "./preview-frame";
import { previewInitials, type PreviewProps } from "./types";

export function InstagramPreview({ accountName, avatarUrl, text, media, mode }: PreviewProps) {
  const main = media[0];

  return (
    <PreviewFrame mode={mode}>
      <div className="flex items-center justify-between p-2.5">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={avatarUrl ?? undefined} />
            <AvatarFallback>{previewInitials(accountName)}</AvatarFallback>
          </Avatar>
          <p className="text-sm font-semibold">{accountName}</p>
        </div>
        <MoreHorizontal className="size-4" />
      </div>
      <div className="aspect-square w-full bg-black/5">
        {main &&
          (main.type === "VIDEO" ? (
            <video src={main.url} className="h-full w-full object-contain" controls />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={main.url} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain" />
          ))}
      </div>
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-3">
          <Heart className="size-5" />
          <MessageCircle className="size-5" />
          <Send className="size-5" />
        </div>
        <Bookmark className="size-5" />
      </div>
      <div className="px-3 pb-3 text-sm">
        <p className="font-semibold">0 Gefällt mir</p>
        {text && (
          <p className="whitespace-pre-wrap">
            <span className="font-semibold">{accountName}</span> {text}
          </p>
        )}
      </div>
    </PreviewFrame>
  );
}
