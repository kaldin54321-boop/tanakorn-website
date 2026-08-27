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

          const isHF2 =
            !!process.env.SPACE_ID ||
            fs.existsSync("/data");
          const tmpBase = isHF2 ? "/data" : process.cwd();
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

    // Priority 1: S3-compatible own host (Storj 25GB free no card / Filebase 5GB free no card / R2 10GB) - persistent, not PC-dependent, not Supabase 50MB
    // Configured via S3_* env (S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY)
    // This is your own bucket, not MediaFire/Drive/Mega, separate from Supabase news
    if (isS3Configured()) {
      const s3Key = `${version}/${safeFileName}`;
      // Use Buffer for Filebase S3 to avoid "Unable to calculate hash for flowing readable stream"
      // For 239MB, Buffer is okay (Render has 512MB RAM, HF has 16GB). For 5GB, multipart will handle via S3 Upload
      const fileBuffer = fs.readFileSync(/*turbopackIgnore: true*/ tempFilePath);
      const s3Result = await uploadToS3(s3Key, fileBuffer, fileType);
      try { fs.unlinkSync(tempFilePath); } catch {}
      if (!s3Result.success) {
        return NextResponse.json({ success: false, message: `S3 upload failed: ${s3Result.error}. Check S3_* env (endpoint, bucket, keys) and bucket CORS.` }, { status: 500 });
      }
      // Store S3 key as file_path with s3:// prefix to distinguish from local/uploads and Supabase
      const dbFilePath = `s3://${s3Key}`;
      return NextResponse.json({
        success: true,
        file: { name: fileName, path: dbFilePath, size: fileSize, type: fileType },
        host: "s3-persistent-own-host",
      });
    }

    // Supabase is NEVER used for APKs - per user request: APKs must go to Filebase/S3 own host or local, not Supabase 50MB
    // Supabase remains only for news/dashboard/videos table data, not for APK bucket
    // If S3 not configured (isS3Configured() == false), fallback to local file host below
    // For Render Free, local is ephemeral (/tmp) - user MUST set Filebase S3 env for persistent 5GB (see .env.example)

    const finalDir = path.join(
      /*turbopackIgnore: true*/ uploadsRoot,
      version
    );
    ensureDir(finalDir);
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

    // Use copyFileSync + unlinkSync for cross-device move (EXDEV fix)
    fs.copyFileSync(tempFilePath, finalPath);
    try { fs.unlinkSync(tempFilePath); } catch {}
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
