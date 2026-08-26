// Alternative file host for releases — not Supabase (50MB) nor busboy PC-dependent (/tmp ephemeral)
// Free, no-card, persistent S3-compatible: Storj (25GB free, no card), Filebase (5GB free, no card), R2 (10GB free, needs card)
// Separate from Supabase news (which stays on Supabase). This is your OWN bucket, not MediaFire/Drive/Mega.

import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

type S3Config = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
};

function getS3Config(): S3Config | null {
  const endpoint = process.env.S3_ENDPOINT || process.env.R2_ENDPOINT || process.env.FILEBASE_ENDPOINT || process.env.STORJ_ENDPOINT;
  const bucket = process.env.S3_BUCKET || process.env.R2_BUCKET || process.env.FILEBASE_BUCKET || process.env.STORJ_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.S3_REGION || process.env.AWS_REGION || "auto";

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;

  return {
    endpoint,
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
    forcePathStyle: endpoint.includes("storj") || endpoint.includes("filebase") ? true : undefined,
  };
}

function createS3Client(config: S3Config): S3Client {
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: config.forcePathStyle,
  });
}

export function isS3Configured(): boolean {
  return getS3Config() !== null;
}

// Upload via multipart (supports 5GB, streaming, no 502 gateway - goes direct S3, not through Render/Vercel)
export async function uploadToS3(
  key: string,
  body: Buffer | Uint8Array | Blob | string | ReadableStream,
  contentType: string
): Promise<{ success: boolean; error?: string }> {
  const config = getS3Config();
  if (!config) return { success: false, error: "S3 not configured" };

  const client = createS3Client(config);

  try {
    // Use lib-storage Upload for multipart (5GB)
    const upload = new Upload({
      client,
      params: {
        Bucket: config.bucket,
        Key: key,
        Body: body as any,
        ContentType: contentType,
      },
      // 6MB parts for 5GB
      partSize: 6 * 1024 * 1024,
      queueSize: 4,
    });

    // Optional progress
    upload.on("httpUploadProgress", (progress) => {
      // progress.loaded / progress.total
    });

    await upload.done();
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Fallback to single PutObject for small files
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: body as any,
          ContentType: contentType,
        })
      );
      return { success: true };
    } catch (e2) {
      return { success: false, error: msg + " | fallback: " + (e2 instanceof Error ? e2.message : String(e2)) };
    }
  }
}

export async function getS3SignedUrl(
  key: string,
  expiresIn: number = 600
): Promise<string | null> {
  const config = getS3Config();
  if (!config) return null;
  const client = createS3Client(config);
  try {
    const command = new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
    });
    const url = await getSignedUrl(client, command, { expiresIn });
    return url;
  } catch {
    return null;
  }
}

export async function s3Exists(key: string): Promise<boolean> {
  const config = getS3Config();
  if (!config) return false;
  const client = createS3Client(config);
  try {
    await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

export function getS3PublicUrl(key: string): string | null {
  const config = getS3Config();
  if (!config) return null;
  // For public buckets, construct public URL
  // R2 public: https://<bucket>.r2.dev/<key> or custom domain
  // For Filebase/Storj, use endpoint + bucket + key
  const base = config.endpoint.replace(/\/$/, "");
  // If endpoint is R2, public URL is different, but signed URL is preferred
  return `${base}/${config.bucket}/${key}`;
}
