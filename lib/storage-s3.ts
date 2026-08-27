// Alternative file host for releases — not Supabase (50MB) nor busboy PC-dependent (/tmp ephemeral)
// Free, no-card, persistent S3-compatible: Storj (25GB free, no card), Filebase (5GB free, no card), R2 (10GB free, needs card)
// Separate from Supabase news (which stays on Supabase). This is your OWN bucket, not MediaFire/Drive/Mega.

import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
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
  let endpoint = process.env.S3_ENDPOINT || process.env.R2_ENDPOINT || process.env.FILEBASE_ENDPOINT || process.env.STORJ_ENDPOINT;
  const bucket = process.env.S3_BUCKET || process.env.R2_BUCKET || process.env.FILEBASE_BUCKET || process.env.STORJ_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.S3_REGION || process.env.AWS_REGION || "auto";

  if (endpoint && bucket && accessKeyId && secretAccessKey) {
    // Normalize Filebase bucket URL mistakenly used as endpoint: https://winlator-releases.s3.filebase.io -> https://s3.filebase.com
    if (endpoint.includes("s3.filebase.io") || endpoint.includes(".s3.filebase.")) {
      endpoint = "https://s3.filebase.com";
    }
    // Ensure endpoint has https
    if (!endpoint.startsWith("http")) endpoint = `https://${endpoint}`;
    return {
      endpoint,
      region,
      bucket,
      accessKeyId,
      secretAccessKey,
      forcePathStyle: endpoint.includes("storj") || endpoint.includes("filebase") ? true : undefined,
    };
  }

  // No S3 env - for Render free, fallback to Supabase 5GB (via fix_winlator_bucket RPC) as persistent own host
  // Local /tmp on Render is ephemeral (lost on exit 137), so we try Supabase first for Render
  if (typeof process !== "undefined" && (process.env.RENDER || process.env.RENDER_SERVICE_ID)) {
    // On Render, try to use Supabase as fallback S3 (with 5GB via RPC) if S3 not configured
    // Supabase S3 endpoint is https://xcahjcxoacyxouvkcvcq.supabase.co/storage/v1/s3
    // But we need S3-compatible endpoint for Supabase Storage S3 API
    // For now, return null and let upload route handle Render via Supabase directly
    return null;
  }
  return null;
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

// Ensure bucket exists, create if missing
export async function ensureBucketExists(): Promise<{ success: boolean; error?: string }> {
  const config = getS3Config();
  if (!config) return { success: false, error: "S3 not configured" };
  const client = createS3Client(config);
  try {
    await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const lower = msg.toLowerCase();
    // Filebase returns 403 if bucket exists but key has no HeadBucket permission, or 404 if truly missing
    if (lower.includes("notfound") || lower.includes("nosuchbucket") || lower.includes("404") || lower.includes("does not exist")) {
      try {
        await client.send(new CreateBucketCommand({ Bucket: config.bucket }));
        return { success: true };
      } catch (e2) {
        const m2 = e2 instanceof Error ? e2.message : String(e2);
        // If creation fails because it already exists (409), treat as success
        if (m2.toLowerCase().includes("already exists") || m2.toLowerCase().includes("bucketalreadyexists") || m2.toLowerCase().includes("409")) {
          return { success: true };
        }
        return { success: false, error: `Bucket "${config.bucket}" not found at ${config.endpoint} and auto-create failed: ${m2}. Create it manually at https://console.filebase.com/buckets → Create Bucket → name: winlator-releases (your link https://winlator-releases.s3.filebase.io confirms it should exist - if you just created it, wait 10s and retry).` };
      }
    }
    // For 403 or other errors, still try upload - bucket may exist but HeadBucket not allowed
    if (lower.includes("403") || lower.includes("forbidden") || lower.includes("access denied")) {
      return { success: true };
    }
    return { success: true }; // try upload anyway
  }
}

// Upload via multipart (supports 5GB, streaming, no 502 gateway - goes direct S3, not through Render/Vercel)
// FIX: Use Buffer for fallback to avoid "Unable to calculate hash for flowing readable stream"
export async function uploadToS3(
  key: string,
  body: Buffer | Uint8Array | Blob | string | ReadableStream,
  contentType: string
): Promise<{ success: boolean; error?: string }> {
  const config = getS3Config();
  if (!config) return { success: false, error: "S3 not configured" };

  // Ensure bucket exists first
  const bucketCheck = await ensureBucketExists();
  if (!bucketCheck.success) return bucketCheck;

  const client = createS3Client(config);

  // For Filebase/Storj, the bucket link https://winlator-releases.s3.filebase.io uses .io but endpoint is https://s3.filebase.com (.com)
  // Normalize endpoint host
  try {
    const upload = new Upload({
      client,
      params: {
        Bucket: config.bucket,
        Key: key,
        Body: body as any,
        ContentType: contentType,
      },
      partSize: 6 * 1024 * 1024,
      queueSize: 4,
    });
    upload.on("httpUploadProgress", () => {});
    await upload.done();
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("NoSuchBucket") || msg.includes("does not exist")) {
      return { success: false, error: `The specified bucket does not exist (Filebase bucket "winlator-releases" not found at ${config.endpoint}). Create it in Filebase dashboard at https://console.filebase.com/buckets → Create Bucket → name: winlator-releases` };
    }
    // Fallback: read stream into Buffer for hash calculation (fixes flowing stream error)
    try {
      let bufferBody: Buffer;
      if (body instanceof Buffer) bufferBody = body;
      else if (body instanceof Uint8Array) bufferBody = Buffer.from(body);
      else if (typeof body === "string") bufferBody = Buffer.from(body);
      else {
        // ReadableStream - read fully
        const chunks: Uint8Array[] = [];
        const reader = (body as ReadableStream).getReader?.();
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) chunks.push(value);
          }
          const total = chunks.reduce((a, c) => a + c.length, 0);
          bufferBody = Buffer.alloc(total);
          let off = 0;
          for (const c of chunks) { bufferBody.set(c, off); off += c.length; }
        } else {
          // File stream that already flowed - cannot retry, return original error
          return { success: false, error: msg };
        }
      }
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: bufferBody,
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
