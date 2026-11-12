import { S3Client } from "@aws-sdk/client-s3";

// S3-compatible client. Local dev points at MinIO (docker-compose.yml);
// production points at Cloudflare R2 or any S3-compatible provider.
// S3_PUBLIC_BASE_URL must be a publicly reachable HTTPS URL in production —
// the Instagram Graph API fetches media by URL during publish.
export const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? "us-east-1",
  forcePathStyle: true, // required for MinIO
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
  },
});

export const S3_BUCKET = process.env.S3_BUCKET ?? "social-planner-media";
export const S3_PUBLIC_BASE_URL = process.env.S3_PUBLIC_BASE_URL ?? "";

export function publicMediaUrl(storageKey: string): string {
  return `${S3_PUBLIC_BASE_URL.replace(/\/$/, "")}/${storageKey}`;
}
