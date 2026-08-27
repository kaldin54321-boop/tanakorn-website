import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { S3Client, HeadBucketCommand, ListBucketsCommand } from "@aws-sdk/client-s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getS3Config() {
  const endpoint = process.env.S3_ENDPOINT || process.env.R2_ENDPOINT || process.env.FILEBASE_ENDPOINT || process.env.STORJ_ENDPOINT;
  const bucket = process.env.S3_BUCKET || process.env.R2_BUCKET || process.env.FILEBASE_BUCKET || process.env.STORJ_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.S3_REGION || process.env.AWS_REGION || "auto";
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;
  let ep = endpoint;
  if (ep.includes("s3.filebase.io")) ep = "https://s3.filebase.com";
  if (!ep.startsWith("http")) ep = `https://${ep}`;
  return { endpoint: ep, bucket, accessKeyId, secretAccessKey, region, forcePathStyle: ep.includes("storj") || ep.includes("filebase") ? true : undefined };
}

export async function GET() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims ?? null;
  if (!claims) return NextResponse.json({ success: false, message: "Not logged in" }, { status: 401 });

  const rawEndpoint = process.env.S3_ENDPOINT || process.env.FILEBASE_ENDPOINT || "";
  const rawBucket = process.env.S3_BUCKET || process.env.FILEBASE_BUCKET || "";
  const hasS3Env = !!process.env.S3_ENDPOINT && !!process.env.S3_BUCKET && !!process.env.S3_ACCESS_KEY_ID && !!process.env.S3_SECRET_ACCESS_KEY;
  const hasFilebaseEnv = !!process.env.FILEBASE_ENDPOINT || !!process.env.FILEBASE_BUCKET;

  const config = getS3Config();
  const result: any = {
    hasS3Env,
    hasFilebaseEnv,
    rawEndpoint,
    rawBucket,
    endpoint: config?.endpoint || null,
    bucket: config?.bucket || null,
    region: config?.region || null,
    winlatorReleasesUrl: "https://winlator-releases.s3.filebase.io",
    s3EndpointForFilebase: "https://s3.filebase.com",
  };

  if (!config) {
    result.status = "S3_NOT_CONFIGURED";
    result.message = "S3_* env not set on this host. Filebase bucket https://winlator-releases.s3.filebase.io will not work until S3_ENDPOINT=https://s3.filebase.com, S3_BUCKET=winlator-releases, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY are set in Render Dashboard → Environment.";
    return NextResponse.json(result);
  }

  // Try to list buckets and head the specific bucket
  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    forcePathStyle: config.forcePathStyle,
  });

  try {
    const list = await client.send(new ListBucketsCommand({}));
    result.listBuckets = list.Buckets?.map(b => b.Name) || [];
    result.listSuccess = true;
  } catch (e) {
    result.listError = e instanceof Error ? e.message : String(e);
    result.listSuccess = false;
  }

  try {
    await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
    result.headBucket = "exists";
    result.status = "OK_BUCKET_EXISTS";
    result.message = `Bucket ${config.bucket} exists at ${config.endpoint}, upload should work.`;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    result.headBucket = "not_found_or_no_access";
    result.headError = msg;
    result.status = "BUCKET_NOT_FOUND";
    result.message = `HeadBucket failed for ${config.bucket} at ${config.endpoint}: ${msg}. Ensure bucket was created in Filebase dashboard at https://console.filebase.com/buckets and S3 keys have access. Your link https://winlator-releases.s3.filebase.io is the bucket's gateway URL, but S3_ENDPOINT must be https://s3.filebase.com (not the bucket URL).`;
  }

  return NextResponse.json(result);
}
