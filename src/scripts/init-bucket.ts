import "dotenv/config";
import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  PutBucketCorsCommand,
} from "@aws-sdk/client-s3";

// One-time local-dev setup: creates the MinIO bucket and makes objects in it
// publicly readable (required — Meta/LinkedIn fetch media by URL at publish
// time) plus allows the browser to PUT uploads directly from the app's origin.
// In production (Cloudflare R2 etc.) configure the equivalent manually, or
// adapt this script for R2's API.

async function main() {
  const bucket = process.env.S3_BUCKET ?? "social-planner-media";
  const appOrigin = process.env.AUTH_URL ?? "http://localhost:3000";

  const client = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? "us-east-1",
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    },
  });

  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log(`Bucket "${bucket}" already exists.`);
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    console.log(`Created bucket "${bucket}".`);
  }

  await client.send(
    new PutBucketPolicyCommand({
      Bucket: bucket,
      Policy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: "*",
            Action: "s3:GetObject",
            Resource: `arn:aws:s3:::${bucket}/*`,
          },
        ],
      }),
    }),
  );

  await client.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedMethods: ["GET", "PUT"],
            AllowedOrigins: [appOrigin],
            AllowedHeaders: ["*"],
          },
        ],
      },
    }),
  );

  console.log(`Bucket "${bucket}" is public-read with CORS enabled for ${appOrigin}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
