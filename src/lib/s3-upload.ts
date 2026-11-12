import "server-only";
import { randomUUID } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, S3_BUCKET, publicMediaUrl } from "@/lib/s3";

// Conservative, format-level checks done at upload time. Exact per-platform
// limits (aspect ratio, duration, carousel counts, ...) are enforced when
// actually publishing (Phase 5) since they vary per endpoint/media type.
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png"];
export const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime"];
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB
export const MAX_VIDEO_BYTES = 1024 * 1024 * 1024; // 1GB sanity cap

export function mediaTypeForContentType(contentType: string): "IMAGE" | "VIDEO" | null {
  if (ALLOWED_IMAGE_TYPES.includes(contentType)) return "IMAGE";
  if (ALLOWED_VIDEO_TYPES.includes(contentType)) return "VIDEO";
  return null;
}

export function maxBytesForContentType(contentType: string): number {
  return ALLOWED_VIDEO_TYPES.includes(contentType) ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
}

export async function createPresignedUpload(
  workspaceId: string,
  filename: string,
  contentType: string,
) {
  const storageKey = `${workspaceId}/${randomUUID()}-${sanitizeFilename(filename)}`;
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: storageKey,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });
  return { uploadUrl, storageKey, publicUrl: publicMediaUrl(storageKey) };
}
