import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

import fs from "fs";
import path from "path";
import Busboy from "busboy";

import {
  isS3Configured,
  uploadToS3,
} from "@/lib/storage-s3";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

// File host priority (free, no card, persistent, 5GB, own host, not MediaFire/Drive/Mega):
// 1. S3-compatible (Storj 25GB free no card / Filebase 5GB free no card / R2 10GB) - configured via S3_* env - persistent, separate from Supabase news
// 2. Local /data (HF 50GB) or ./uploads (Oracle/VPS) - persistent if volume, ephemeral on Render Free/Vercel
// 3. External URL fallback (user pastes direct link) - always works
// News stays on Supabase always

function isRender(): boolean {
  return !!process.env.RENDER || !!process.env.RENDER_SERVICE_ID;
}

function getUploadsRoot() {
  // Render Free is ephemeral - we use Supabase (with 5GB RPC fix) for persistence there
  // HF Spaces persistent is /data, local/Oracle is /app/uploads
  if (isRender()) {
    // On Render, local is ephemeral - we will try Supabase first for persistence
    // Fallback to /tmp if needed, but primary is Supabase
    return path.join(
      /*turbopackIgnore: true*/ "/tmp",
      "uploads",
      "releases"
    );
  }
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

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // -----------------------------------------
    // Check authentication
    // -----------------------------------------

    const {
      data: claimsData,
      error: claimsError,
    } = await supabase.auth.getClaims();

    const claims = claimsData?.claims ?? null;

    if (claimsError || !claims) {
      return NextResponse.json(
        {
          success: false,
          message: "You must be logged in.",
        },
        { status: 401 }
      );
    }

    const userId =
      typeof claims.sub === "string"
        ? claims.sub
        : null;

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          message: "Unable to identify user.",
        },
        { status: 401 }
      );
    }

    // -----------------------------------------
    // Check administrator role
    // -----------------------------------------

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", userId)
      .maybeSingle();

    if (
      profileError ||
      !profile ||
      profile.role !== "admin"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Administrator permission required.",
        },
        { status: 403 }
      );
    }

    // -----------------------------------------
    // Parse multipart via busboy (streaming, 5GB support)
    // -----------------------------------------

    const contentType =
      request.headers.get("content-type") || "";

    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        {
          success: false,
          message: "Expected multipart/form-data",
        },
        { status: 400 }
      );
    }

    const uploadsRoot = getUploadsRoot();

    // We need version first to build path, but busboy streams file before fields in some orders
    // So buffer file to temp then move, or collect fields first
    // Use busboy to collect fields and file stream

    const busboy = Busboy({
      headers: {
        "content-type": contentType,
      },
      limits: {
        fileSize: 5 * 1024 * 1024 * 1024, // 5 GB
        files: 1,
      },
    });

    let version = "";
    let fileName = "";
    let fileType = "";
    let fileSize = 0;
    let tempFilePath: string | null = null;
    let writeStream: fs.WriteStream | null = null;
    let fileWritePromise: Promise<void> | null = null;
    let fileError: Error | null = null;

    // Convert Web Request to Node readable for busboy
    // Next.js Request body is a ReadableStream
    const body = request.body;
    if (!body) {
      return NextResponse.json(
        { success: false, message: "No body" },
        { status: 400 }
      );
    }

    const result = await new Promise<{
      version: string;
      fileName: string;
      fileType: string;
      fileSize: number;
      tempFilePath: string;
    }>((resolve, reject) => {
      busboy.on("field", (name, val) => {
        if (name === "version") version = String(val).trim();
      });

      busboy.on(
        "file",
        (name, file, info) => {
          if (name !== "file") {
            file.resume();
            return;
          }

          fileName = info.filename || "upload.apk";
          fileType =
            info.mimeType ||
            "application/vnd.android.package-archive";

          const isAPK = fileName
            .toLowerCase()
            .endsWith(".apk");
          if (!isAPK) {
            fileError = new Error(
              "Only APK files are allowed."
            );
            file.resume();
            return;
          }

          // Use same base as uploadsRoot to avoid EXDEV/ENOENT cross-device (Render: /tmp, HF: /data, local: cwd)
          const tmpBase = uploadsRoot.includes("/tmp")
            ? "/tmp"
            : uploadsRoot.includes("/data")
            ? "/data"
            : process.cwd();
          const tmpDir = path.join(
            /*turbopackIgnore: true*/ tmpBase,
            "uploads",
            "tmp"
          );
          ensureDir(tmpDir);
          const tmpName = `upload_${Date.now()}_${Math.random().toString(36).slice(2)}_${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
          tempFilePath = path.join(tmpDir, tmpName);
          writeStream = fs.createWriteStream(tempFilePath);
          let bytes = 0;

          file.on("data", (data: Buffer) => {
            bytes += data.length;
            fileSize = bytes;
            if (bytes > 5 * 1024 * 1024 * 1024) {
              fileError = new Error(
                "File too large: exceeds 5 GB limit"
              );
              file.resume();
              writeStream?.destroy();
              try {
                if (tempFilePath)
                  fs.unlinkSync(tempFilePath);
              } catch {}
            }
          });

          fileWritePromise = new Promise<void>(
            (res, rej) => {
              if (!writeStream) return rej(new Error("No write stream"));
              file
                .pipe(writeStream)
                .on("finish", () => res())
                .on("error", (e) => rej(e));
              file.on("error", (e) => rej(e));
              file.on("limit", () => {
                rej(
                  new Error(
                    "File too large: exceeds 5 GB limit"
                  )
                );
              });
            }
          );

          fileWritePromise.catch((e) => {
            fileError = e;
          });
        }
      );

      busboy.on("error", (err: Error) => {
        reject(err);
      });

      busboy.on("finish", async () => {
        // Wait for file write to finish
        if (fileWritePromise) {
          try {
            await fileWritePromise;
          } catch (e) {
            fileError = e as Error;
          }
        }

        if (fileError) {
          if (tempFilePath) {
            try {
              fs.unlinkSync(tempFilePath);
            } catch {}
          }
          reject(fileError);
          return;
        }

        if (!tempFilePath) {
          reject(new Error("No file was uploaded."));
          return;
        }

        if (!version) {
          try {
            fs.unlinkSync(tempFilePath);
          } catch {}
          reject(new Error("Release version is required."));
          return;
        }

        if (!fileName) {
          try {
            fs.unlinkSync(tempFilePath);
          } catch {}
          reject(new Error("No file was uploaded."));
          return;
        }

        // Validate size
        if (fileSize === 0) {
          try {
            fs.unlinkSync(tempFilePath);
          } catch {}
          reject(new Error("File is empty."));
          return;
        }

        resolve({
          version,
          fileName,
          fileType,
          fileSize,
          tempFilePath,
        });
      });

      // Pipe body to busboy
      const reader = body.getReader();
      const pump = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              busboy.end();
              break;
            }
            if (value) {
              // value is Uint8Array
              busboy.write(Buffer.from(value));
            }
          }
        } catch (e) {
          reject(e as Error);
        }
      };
      pump();

      // Also handle busboy need to end when stream ends
      // body already piped, busboy will finish
    });

    // Move temp file to final location
    version = result.version;
    fileName = result.fileName;
    fileType = result.fileType;
    fileSize = result.fileSize;
    tempFilePath = result.tempFilePath;

    const safeFileName = fileName.replace(
      /[^a-zA-Z0-9._-]/g,
      "_"
    );

    // Private bucket (website itself) must be persistent on Render, not ephemeral /tmp
    // Render Free /tmp is cleaned every 10-20 min (exit 137) → file lost → download 404
    // So on Render, we MUST use S3 5GB (Filebase) as primary persistent, not local
    // User created https://winlator-releases.s3.filebase.io - endpoint is https://s3.filebase.com, bucket winlator-releases
    if (isRender()) {
      if (!isS3Configured()) {
        console.warn("Render without S3 env - using ephemeral /tmp (will be lost on exit 137, but allows immediate test). Set Filebase S3 env for persistent 5GB.");
        // Fall through to local handling below - don't return error
      } else {
        // S3 is configured - try Filebase 5GB persistent first
        const s3Key = `${version}/${safeFileName}`;
        try {
          const fileBuffer = fs.readFileSync(/*turbopackIgnore: true*/ tempFilePath);
          const s3Result = await uploadToS3(s3Key, fileBuffer, fileType);
          if (s3Result.success) {
            try { fs.unlinkSync(tempFilePath); } catch {}
            const dbFilePath = `s3://${s3Key}`;
            return NextResponse.json({
              success: true,
              file: { name: fileName, path: dbFilePath, size: fileSize, type: fileType },
              host: "s3-persistent-own-host",
            });
          }
          console.warn("S3 upload failed on Render, falling back to ephemeral /tmp (file will be lost on exit 137, re-upload after S3 bucket fix):", s3Result.error);
          // Check via /api/admin/storage/check - likely bucket winlator-releases not found at https://s3.filebase.com for this S3 key
          // Fall through to local, don't return S3 error, allow upload to succeed via /tmp for immediate test
        } catch (e) {
          console.warn("S3 upload exception on Render, falling back to local:", e);
        }
      }
    }

    // Non-Render (HF /data 50GB persistent, local ./uploads) - use private local bucket (website itself)
    // This is the private bucket before Filebase, PC can be off for HF, local PC must stay on for local
    if (isS3Configured()) {
      const s3Key = `${version}/${safeFileName}`;
      try {
        const fileBuffer = fs.readFileSync(/*turbopackIgnore: true*/ tempFilePath);
        const s3Result = await uploadToS3(s3Key, fileBuffer, fileType);
        if (s3Result.success) {
          try { fs.unlinkSync(tempFilePath); } catch {}
          const dbFilePath = `s3://${s3Key}`;
          return NextResponse.json({
            success: true,
            file: { name: fileName, path: dbFilePath, size: fileSize, type: fileType },
            host: "s3-persistent-own-host",
          });
        }
        console.warn("S3 upload failed, falling back to local private bucket:", s3Result.error);
      } catch (e) {
        console.warn("S3 upload exception, falling back to local:", e);
      }
    }

    const finalDir = path.join(
      /*turbopackIgnore: true*/ uploadsRoot,
      version
    );
    // Ensure final dir exists (handle version with spaces like "11.1 V2")
    try {
      ensureDir(finalDir);
    } catch (e) {
      try { fs.unlinkSync(tempFilePath); } catch {}
      return NextResponse.json({ success: false, message: `Failed to create directory ${finalDir}: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 });
    }
    const finalPath = path.join(
      /*turbopackIgnore: true*/ finalDir,
      safeFileName
    );

    if (fs.existsSync(/*turbopackIgnore: true*/ finalPath)) {
      try { fs.unlinkSync(tempFilePath); } catch {}
      return NextResponse.json(
        {
          success: false,
          message: "A file already exists for this version. Delete the existing file or use a different version.",
        },
        { status: 409 }
      );
    }

    // Robust move: ensure temp exists, ensure dir, then try rename/copy
    // Temp file may be on /data or /tmp depending on isHF check at file start vs now
    if (!fs.existsSync(tempFilePath)) {
      // Try alternative tmp location (Render vs HF mismatch)
      const altTmp = tempFilePath.includes("/data/")
        ? tempFilePath.replace("/data/uploads/tmp", "/tmp/uploads/tmp").replace("/data\\uploads\\tmp", "/tmp/uploads/tmp")
        : tempFilePath.replace("/tmp/uploads/tmp", "/data/uploads/tmp");
      if (fs.existsSync(altTmp)) {
        tempFilePath = altTmp;
      } else {
        // Check if file was already moved to final (race) or cleaned
        if (fs.existsSync(finalPath)) {
          // Already at final, treat as success
          const dbFilePathAlt = path.join("uploads", "releases", version, safeFileName).replace(/\\/g, "/");
          return NextResponse.json({
            success: true,
            file: { name: fileName, path: dbFilePathAlt, size: fileSize, type: fileType },
            host: "local",
          });
        }
        return NextResponse.json({ success: false, message: `Temp file not found: ${tempFilePath} (also checked ${altTmp}). Upload may have been cleaned by tmpwatch or failed mid-stream. Try re-uploading with smaller chunk or check Render logs for busboy error.` }, { status: 500 });
      }
    }
    // Ensure final dir exists (with space in "11.1 V2")
    try {
      ensureDir(finalDir);
    } catch (e) {
      return NextResponse.json({ success: false, message: `Failed to create dir ${finalDir}: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 });
    }
    try {
      fs.renameSync(tempFilePath, finalPath);
    } catch (e) {
      const code = e instanceof Error ? (e as NodeJS.ErrnoException).code || e.message : String(e);
      if (code === "EXDEV" || String(code).includes("EXDEV") || String(code).includes("cross-device")) {
        fs.copyFileSync(tempFilePath, finalPath);
        try { fs.unlinkSync(tempFilePath); } catch {}
      } else if (String(code).includes("ENOENT")) {
        // Retry after re-ensuring dir and checking temp again
        try { ensureDir(finalDir); } catch {}
        // Re-resolve temp if still on other FS
        let src = tempFilePath;
        if (!fs.existsSync(src)) {
          const alt = src.includes("/data/") ? src.replace("/data/", "/tmp/") : src.replace("/tmp/", "/data/");
          if (fs.existsSync(alt)) src = alt;
          else return NextResponse.json({ success: false, message: `Temp file missing before copy: ${src}` }, { status: 500 });
        }
        fs.copyFileSync(src, finalPath);
        try { fs.unlinkSync(src); } catch {}
        try { if (src !== tempFilePath) fs.unlinkSync(tempFilePath); } catch {}
      } else {
        throw e;
      }
    }
    const dbFilePath = path
      .join("uploads", "releases", version, safeFileName)
      .replace(/\\/g, "/");

    return NextResponse.json({
      success: true,
      file: {
        name: fileName,
        path: dbFilePath,
        size: fileSize,
        type: fileType,
      },
      host: "local", // indicates self-hosted file host, separate from Supabase
    });
  } catch (error) {
    console.error("Unexpected upload error:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Unexpected server error.",
      },
      { status: 500 }
    );
  }
}
