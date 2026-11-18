"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  requestReviewMediaUploadAction,
  confirmReviewMediaUploadAction,
  deleteReviewMediaAction,
} from "@/app/review/[token]/actions";

type UploadedItem = { id: string; url: string; type: "IMAGE" | "VIDEO" };

export function ReviewUpload({ token }: { token: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<UploadedItem[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(mediaId: string) {
    setDeletingId(mediaId);
    try {
      await deleteReviewMediaAction(token, mediaId);
      setUploaded((prev) => prev.filter((item) => item.id !== mediaId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Löschen fehlgeschlagen.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const { uploadUrl, storageKey, publicUrl, mediaType } = await requestReviewMediaUploadAction(
          token,
          file.name,
          file.type,
          file.size,
        );

        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!putRes.ok) throw new Error("Upload fehlgeschlagen.");

        const media = await confirmReviewMediaUploadAction(token, {
          storageKey,
          url: publicUrl,
          type: mediaType,
        });
        setUploaded((prev) => [{ id: media.id, url: media.url, type: media.type }, ...prev]);
      }
      toast.success("Danke! Die Dateien sind angekommen.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload fehlgeschlagen.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="flex items-center justify-between gap-3">
        <div>
          <CardTitle className="text-sm">Material hochladen</CardTitle>
          <CardDescription className="text-xs">Fotos oder Videos direkt hochladen.</CardDescription>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,video/mp4,video/quicktime"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="shrink-0"
        >
          <Upload className="size-3.5" />
          {uploading ? "Lädt…" : "Hochladen"}
        </Button>
      </CardHeader>
      {uploaded.length > 0 && (
        <CardContent className="flex flex-wrap gap-2">
          {uploaded.map((item) => (
            <div
              key={item.id}
              className="relative size-16 overflow-hidden rounded-md border bg-muted"
            >
              {item.type === "IMAGE" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                  Video
                </div>
              )}
              <button
                type="button"
                onClick={() => handleDelete(item.id)}
                disabled={deletingId === item.id}
                aria-label="Löschen"
                title="Löschen"
                className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-destructive"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}
