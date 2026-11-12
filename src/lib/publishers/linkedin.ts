import type { PublishInput, PublishResult } from "./types";

// LinkedIn's current Posts API (replaces the legacy /v2/ugcPosts). Version
// per LinkedIn's versioning docs (YYYYMM) — bump periodically; see
// https://learn.microsoft.com/en-us/linkedin/marketing/versioning.
const LINKEDIN_VERSION = "202610";
const API_BASE = "https://api.linkedin.com/rest";

function authHeaders(accessToken: string, extra?: Record<string, string>) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "X-Restli-Protocol-Version": "2.0.0",
    "Linkedin-Version": LINKEDIN_VERSION,
    ...extra,
  };
}

// SocialAccount.externalAccountId is the member's `sub` for a personal
// profile, or "org:{id}" for a Company Page (see src/app/api/connect/linkedin).
function authorUrn(externalAccountId: string): string {
  return externalAccountId.startsWith("org:")
    ? `urn:li:organization:${externalAccountId.slice(4)}`
    : `urn:li:person:${externalAccountId}`;
}

async function uploadImage(ownerUrn: string, accessToken: string, imageUrl: string): Promise<string> {
  const initRes = await fetch(`${API_BASE}/images?action=initializeUpload`, {
    method: "POST",
    headers: authHeaders(accessToken, { "Content-Type": "application/json" }),
    body: JSON.stringify({ initializeUploadRequest: { owner: ownerUrn } }),
  });
  const initBody = await initRes.json();
  if (!initRes.ok) throw new Error(initBody.message ?? "LinkedIn Image-Upload fehlgeschlagen.");
  const { uploadUrl, image } = initBody.value as { uploadUrl: string; image: string };

  const sourceRes = await fetch(imageUrl);
  if (!sourceRes.ok) throw new Error("Bild konnte nicht von der Quelle geladen werden.");
  const buffer = await sourceRes.arrayBuffer();

  const putRes = await fetch(uploadUrl, { method: "PUT", body: buffer });
  if (!putRes.ok) throw new Error("Bild-Upload zu LinkedIn fehlgeschlagen.");

  return image;
}

type VideoUploadInstruction = { firstByte: number; lastByte: number; uploadUrl: string };

async function uploadVideo(ownerUrn: string, accessToken: string, videoUrl: string): Promise<string> {
  const sourceRes = await fetch(videoUrl);
  if (!sourceRes.ok) throw new Error("Video konnte nicht von der Quelle geladen werden.");
  const buffer = Buffer.from(await sourceRes.arrayBuffer());

  const initRes = await fetch(`${API_BASE}/videos?action=initializeUpload`, {
    method: "POST",
    headers: authHeaders(accessToken, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      initializeUploadRequest: {
        owner: ownerUrn,
        fileSizeBytes: buffer.byteLength,
        uploadCaptions: false,
        uploadThumbnail: false,
      },
    }),
  });
  const initBody = await initRes.json();
  if (!initRes.ok) throw new Error(initBody.message ?? "LinkedIn Video-Upload fehlgeschlagen.");
  const { video, uploadInstructions, uploadToken } = initBody.value as {
    video: string;
    uploadInstructions: VideoUploadInstruction[];
    uploadToken: string;
  };

  const uploadedPartIds: string[] = [];
  for (const part of uploadInstructions) {
    const chunk = buffer.subarray(part.firstByte, part.lastByte + 1);
    const putRes = await fetch(part.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: chunk,
    });
    if (!putRes.ok) throw new Error("Video-Upload (Teil) zu LinkedIn fehlgeschlagen.");
    const etag = putRes.headers.get("etag");
    if (!etag) throw new Error("LinkedIn hat keinen ETag für den Video-Teil zurückgegeben.");
    uploadedPartIds.push(etag.replaceAll('"', ""));
  }

  const finalizeRes = await fetch(`${API_BASE}/videos?action=finalizeUpload`, {
    method: "POST",
    headers: authHeaders(accessToken, { "Content-Type": "application/json" }),
    body: JSON.stringify({ finalizeUploadRequest: { video, uploadToken, uploadedPartIds } }),
  });
  if (!finalizeRes.ok) {
    const body = await finalizeRes.json().catch(() => ({}) as Record<string, unknown>);
    throw new Error((body.message as string) ?? "Finalisieren des LinkedIn-Video-Uploads fehlgeschlagen.");
  }

  return video;
}

export async function publishToLinkedIn(input: PublishInput): Promise<PublishResult> {
  const { accessToken, externalAccountId, text, media } = input;
  const author = authorUrn(externalAccountId);

  if (media.length > 1) {
    return {
      success: false,
      error: "Mehrere Medien pro LinkedIn-Post werden noch nicht unterstützt (LinkedIn MultiImage API).",
    };
  }

  try {
    let content: { media: { id: string } } | undefined;

    if (media.length === 1) {
      const item = media[0];
      const assetUrn =
        item.type === "VIDEO"
          ? await uploadVideo(author, accessToken, item.url)
          : await uploadImage(author, accessToken, item.url);
      content = { media: { id: assetUrn } };
    }

    const postRes = await fetch(`${API_BASE}/posts`, {
      method: "POST",
      headers: authHeaders(accessToken, { "Content-Type": "application/json" }),
      body: JSON.stringify({
        author,
        commentary: text,
        visibility: "PUBLIC",
        distribution: {
          feedDistribution: "MAIN_FEED",
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false,
        ...(content ? { content } : {}),
      }),
    });

    if (!postRes.ok) {
      const body = await postRes.json().catch(() => ({}) as Record<string, unknown>);
      return {
        success: false,
        error: (body.message as string) ?? `LinkedIn-Post fehlgeschlagen (HTTP ${postRes.status}).`,
      };
    }

    return { success: true, externalPostId: postRes.headers.get("x-restli-id") ?? "" };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
