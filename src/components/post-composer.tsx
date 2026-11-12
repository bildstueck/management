"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Settings2 } from "lucide-react";
import type { Platform } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MediaPickerGrid, type MediaOption } from "@/components/media-picker-grid";
import { PLATFORM_META } from "@/components/platform-meta";
import { FacebookPreview } from "@/components/previews/facebook-preview";
import { InstagramPreview } from "@/components/previews/instagram-preview";
import { LinkedInPreview } from "@/components/previews/linkedin-preview";
import {
  requestMediaUploadAction,
  confirmMediaUploadAction,
  savePostAction,
} from "@/app/(app)/w/[slug]/posts/actions";

type AccountOption = {
  id: string;
  platform: Platform;
  displayName: string;
  avatarUrl: string | null;
};

type ChannelOverride = { text: string; mediaIds: string[] };

export type InitialPost = {
  id: string;
  masterText: string;
  masterMediaIds: string[];
  scheduledAt: string | null; // "YYYY-MM-DD"
  channels: { socialAccountId: string; text: string | null; mediaIds: string[] }[];
};

function readImageDimensions(file: File): Promise<{ width?: number; height?: number }> {
  if (!file.type.startsWith("image/")) return Promise.resolve({});
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve({});
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

export function PostComposer({
  slug,
  accounts,
  initialMedia,
  initialPost,
}: {
  slug: string;
  accounts: AccountOption[];
  initialMedia: MediaOption[];
  initialPost: InitialPost | null;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [postId, setPostId] = useState(initialPost?.id ?? null);
  const [masterText, setMasterText] = useState(initialPost?.masterText ?? "");
  const [masterMediaIds, setMasterMediaIds] = useState<string[]>(
    initialPost?.masterMediaIds ?? [],
  );
  const [scheduledAt, setScheduledAt] = useState(initialPost?.scheduledAt ?? "");
  const [mediaLibrary, setMediaLibrary] = useState<MediaOption[]>(initialMedia);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>(
    initialPost?.channels.map((c) => c.socialAccountId) ?? [],
  );
  const [overrides, setOverrides] = useState<Record<string, ChannelOverride>>(() => {
    const result: Record<string, ChannelOverride> = {};
    if (!initialPost) return result;
    for (const channel of initialPost.channels) {
      // A channel only counts as "customized" if it was actually saved
      // differently from the master — otherwise it stays linked to it, so
      // further master edits keep flowing through on reload.
      const sameText = (channel.text ?? "") === initialPost.masterText;
      const sameMedia =
        JSON.stringify(channel.mediaIds) === JSON.stringify(initialPost.masterMediaIds);
      if (!sameText || !sameMedia) {
        result[channel.socialAccountId] = { text: channel.text ?? "", mediaIds: channel.mediaIds };
      }
    }
    return result;
  });
  const [activePreviewId, setActivePreviewId] = useState<string | null>(
    selectedAccountIds[0] ?? null,
  );
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("mobile");
  const [uploading, setUploading] = useState(false);
  const [isSaving, startSaving] = useTransition();

  const mediaById = new Map(mediaLibrary.map((m) => [m.id, m]));

  function toggleAccount(accountId: string) {
    setSelectedAccountIds((prev) => {
      const next = prev.includes(accountId)
        ? prev.filter((id) => id !== accountId)
        : [...prev, accountId];
      if (!prev.includes(accountId)) setActivePreviewId(accountId);
      return next;
    });
  }

  function enableOverride(accountId: string) {
    setOverrides((prev) => ({
      ...prev,
      [accountId]: prev[accountId] ?? { text: masterText, mediaIds: masterMediaIds },
    }));
  }

  function clearOverride(accountId: string) {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[accountId];
      return next;
    });
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const { uploadUrl, storageKey, publicUrl, mediaType } = await requestMediaUploadAction(
          slug,
          file.name,
          file.type,
          file.size,
        );

        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!putRes.ok) throw new Error("Upload zu S3/MinIO fehlgeschlagen.");

        const dimensions = await readImageDimensions(file);
        const media = await confirmMediaUploadAction(slug, {
          storageKey,
          url: publicUrl,
          type: mediaType,
          ...dimensions,
        });

        setMediaLibrary((prev) => [{ id: media.id, type: media.type, url: media.url }, ...prev]);
        setMasterMediaIds((prev) => [...prev, media.id]);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload fehlgeschlagen.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleSave() {
    const channels = selectedAccountIds.map((accountId) => {
      const override = overrides[accountId];
      return {
        socialAccountId: accountId,
        text: override ? override.text : masterText,
        mediaIds: override ? override.mediaIds : masterMediaIds,
      };
    });

    startSaving(async () => {
      try {
        const result = await savePostAction(slug, {
          postId: postId ?? undefined,
          masterText: masterText || null,
          masterMediaIds,
          scheduledAt: scheduledAt || null,
          channels,
        });
        if (!postId) {
          setPostId(result.id);
          router.replace(`/w/${slug}/posts/${result.id}`);
        }
        toast.success("Entwurf gespeichert.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
      }
    });
  }

  const selectedAccounts = accounts.filter((a) => selectedAccountIds.includes(a.id));

  function resolveMedia(ids: string[]) {
    return ids.map((id) => mediaById.get(id)).filter((m): m is MediaOption => !!m);
  }

  function renderPreview(account: AccountOption) {
    const override = overrides[account.id];
    const text = override ? override.text : masterText;
    const media = resolveMedia(override ? override.mediaIds : masterMediaIds);
    const props = {
      accountName: account.displayName,
      avatarUrl: account.avatarUrl,
      text,
      media,
      mode: previewMode,
    };
    switch (account.platform) {
      case "FACEBOOK":
        return <FacebookPreview {...props} />;
      case "INSTAGRAM":
        return <InstagramPreview {...props} />;
      case "LINKEDIN":
        return <LinkedInPreview {...props} />;
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Beitragstext</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Textarea
              value={masterText}
              onChange={(e) => setMasterText(e.target.value)}
              placeholder="Was möchtest du teilen?"
              rows={5}
            />
            <div>
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
              >
                {uploading ? "Wird hochgeladen…" : "Medien hochladen"}
              </Button>
            </div>
            <MediaPickerGrid
              media={mediaLibrary}
              selectedIds={masterMediaIds}
              onToggle={(id) =>
                setMasterMediaIds((prev) =>
                  prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
                )
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kanäle</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {accounts.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Noch keine Social Accounts verbunden — siehe Accounts-Tab.
              </p>
            )}
            {accounts.map((account) => {
              const meta = PLATFORM_META[account.platform];
              const Icon = meta.icon;
              const checked = selectedAccountIds.includes(account.id);
              const override = overrides[account.id];
              const effectiveLength = (override ? override.text : masterText).length;

              return (
                <div key={account.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleAccount(account.id)}
                      />
                      <Icon className="size-4" />
                      {account.displayName}
                      <span
                        className={
                          effectiveLength > meta.textLimit
                            ? "text-destructive"
                            : "text-muted-foreground"
                        }
                      >
                        {effectiveLength}/{meta.textLimit}
                      </span>
                    </label>
                    {checked && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          override ? clearOverride(account.id) : enableOverride(account.id)
                        }
                      >
                        <Settings2 className="size-3.5" />
                        {override ? "Zurücksetzen" : "Anpassen"}
                      </Button>
                    )}
                  </div>

                  {checked && override && (
                    <div className="mt-3 flex flex-col gap-2 border-t pt-3">
                      <Textarea
                        value={override.text}
                        onChange={(e) =>
                          setOverrides((prev) => ({
                            ...prev,
                            [account.id]: { ...prev[account.id], text: e.target.value },
                          }))
                        }
                        rows={3}
                      />
                      <MediaPickerGrid
                        media={mediaLibrary}
                        selectedIds={override.mediaIds}
                        onToggle={(id) =>
                          setOverrides((prev) => {
                            const current = prev[account.id];
                            const mediaIds = current.mediaIds.includes(id)
                              ? current.mediaIds.filter((x) => x !== id)
                              : [...current.mediaIds, id];
                            return { ...prev, [account.id]: { ...current, mediaIds } };
                          })
                        }
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="scheduledAt" className="text-xs text-muted-foreground">
              Geplantes Datum (optional, siehe Kalender-Ansicht)
            </label>
            <input
              id="scheduledAt"
              type="date"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
            />
          </div>
          <Button
            onClick={handleSave}
            disabled={isSaving || selectedAccountIds.length === 0}
            className="mt-5"
          >
            {isSaving ? "Wird gespeichert…" : "Entwurf speichern"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">Vorschau</h2>
          <div className="flex gap-1">
            <Button
              type="button"
              size="sm"
              variant={previewMode === "mobile" ? "default" : "outline"}
              onClick={() => setPreviewMode("mobile")}
            >
              Mobile
            </Button>
            <Button
              type="button"
              size="sm"
              variant={previewMode === "desktop" ? "default" : "outline"}
              onClick={() => setPreviewMode("desktop")}
            >
              Desktop
            </Button>
          </div>
        </div>

        {selectedAccounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Wähle links einen Kanal aus.</p>
        ) : (
          <Tabs
            value={activePreviewId ?? selectedAccounts[0].id}
            onValueChange={(value) => setActivePreviewId(value as string)}
          >
            <TabsList>
              {selectedAccounts.map((account) => (
                <TabsTrigger key={account.id} value={account.id}>
                  {PLATFORM_META[account.platform].label}
                </TabsTrigger>
              ))}
            </TabsList>
            {selectedAccounts.map((account) => (
              <TabsContent key={account.id} value={account.id} className="pt-4">
                {renderPreview(account)}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </div>
  );
}
