import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Cloudflare R2 is S3-compatible. We authenticate with an R2 access key
 * and hit the account-scoped endpoint.
 *
 * Required env vars:
 *   R2_ACCOUNT_ID        — from the R2 dashboard
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET            — bucket name
 *   R2_PUBLIC_BASE_URL   — public base URL for served objects
 *                          (e.g. https://pub-xxxxx.r2.dev or https://cdn.example.com)
 */
const endpoint = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

export const r2 = new S3Client({
  region: "auto",
  endpoint,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  // R2 doesn't support the flight-integrity CRC32 header that the AWS SDK
  // now adds by default (>= 3.729). Without this, pre-signed PUTs from the
  // browser fail with HTTP 400 because the SDK signs a placeholder checksum
  // that never matches the real body.
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

export const R2_BUCKET = process.env.R2_BUCKET!;
export const R2_PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL!;

/**
 * Generate a pre-signed PUT URL that the browser can upload directly to.
 * The URL is single-use and expires quickly (default 60s).
 */
export async function createUploadUrl(params: {
  key: string;
  contentType: string;
  maxBytes?: number;
  expiresInSeconds?: number;
}) {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: params.key,
    ContentType: params.contentType,
    // Intentionally NOT signing ContentLength — the browser always sends it,
    // and pinning the exact byte count at sign time causes brittle failures.
    // Enforce size limits server-side before issuing the signed URL instead.
  });
  return getSignedUrl(r2, command, {
    expiresIn: params.expiresInSeconds ?? 60,
  });
}

/** Build the public URL for an object key (via your public domain or r2.dev). */
export function publicUrl(key: string) {
  return `${R2_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`;
}

/** Delete an object. Use when a photo row is hard-deleted. */
export async function deleteObject(key: string) {
  await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
}
