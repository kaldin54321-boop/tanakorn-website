// Storage abstraction: local filesystem (self-hosted/HF) vs R2 (Cloudflare Pages)
// Releases: separate from Supabase (news stays on Supabase)
// - Local: /data/uploads (HF) or ./uploads (Oracle/local) - 5GB, streaming via busboy/fs, Range support
// - R2: Cloudflare Pages (no persistent disk) - use RELEASES_BUCKET binding if available
// - Fallback: external_url (user pastes direct link)

import fs from "fs";
import path from "path";

export function isCloudflarePages(): boolean {
  return !!process.env.CF_PAGES || !!process.env.CLOUDFLARE_PAGES;
}

export function getUploadsRoot(): string {
  // HF Spaces persistent is /data, local/Oracle is process.cwd()/uploads
  const isHF =
    !!process.env.SPACE_ID ||
    !!process.env.SPACE_HOST ||
    fs.existsSync("/data");
  const base = isHF ? "/data" : process.cwd();
  const root = path.join(
    /*turbopackIgnore: true*/ base,
    "uploads",
    "releases"
  );
  return root;
}

export function getTmpDir(): string {
  const isHF =
    !!process.env.SPACE_ID ||
    fs.existsSync("/data");
  const base = isHF ? "/data" : process.cwd();
  return path.join(
    /*turbopackIgnore: true*/ base,
    "uploads",
    "tmp"
  );
}

export function getLocalFilePath(dbPath: string): string {
  // Try HF /data first, then local
  const hfPath = path.join(
    /*turbopackIgnore: true*/ "/data",
    dbPath
  );
  if (fs.existsSync(hfPath)) return hfPath;
  return path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    dbPath
  );
}

export function isLocalPath(p: string): boolean {
  return (
    p.startsWith("uploads/") ||
    p.startsWith("uploads\\") ||
    p.includes("uploads/releases")
  );
}

// For Cloudflare Pages + R2, use this helper to check if R2 is bound
export function hasR2Binding(): boolean {
  // @ts-ignore - R2 binding injected by Cloudflare
  return typeof globalThis !== "undefined" && !!(globalThis as any).RELEASES_BUCKET;
}
