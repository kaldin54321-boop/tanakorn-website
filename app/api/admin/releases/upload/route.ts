import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

import fs from "fs";
import path from "path";
import Busboy from "busboy";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// File host: local (HF/Oracle/VPS) at /data or ./uploads - 5GB, Range support
// Vercel: filesystem is ephemeral (uploads lost on redeploy) + Hobby 10s/60s timeout
// For Vercel, use External APK URL field for 239MB+ (already in UI), or add Vercel Blob/R2
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

    // On Render (ephemeral), use Supabase Storage (persistent, 5GB via RPC) as primary
    // This ensures APK lasts forever even when PC off and Render restarts
    if (isRender()) {
      // Try to fix bucket to 5GB via RPC (no card, SECURITY DEFINER)
      try {
        await supabase.rpc("fix_winlator_bucket" as any);
      } catch {}
      // Upload temp file to Supabase storage
      const supabasePath = `${version}/${safeFileName}`;
      const fileBuffer = fs.readFileSync(tempFilePath);
      // Use service_role if available via env, else use current supabase client (may need RLS)
      const { error: uploadError } = await supabase.storage
        .from("winlator-releases")
        .upload(supabasePath, fileBuffer, {
          contentType: fileType,
          upsert: false,
        });
      // Clean temp
      try { fs.unlinkSync(tempFilePath); } catch {}
      if (uploadError) {
        const isSizeError = uploadError.message?.toLowerCase().includes("maximum allowed size") || uploadError.message?.toLowerCase().includes("exceeded");
        if (isSizeError) {
          return NextResponse.json(
            {
              success: false,
              message: `Supabase bucket still 50MB (run supabase-external-url.sql → fix_winlator_bucket() in Dashboard SQL Editor). For Render Free, use External APK URL as temporary workaround.`,
            },
            { status: 409 }
          );
        }
        return NextResponse.json({ success: false, message: uploadError.message }, { status: 500 });
      }
      // Store Supabase path in DB (download route will create signed URL)
      const dbFilePath = supabasePath;
      return NextResponse.json({
        success: true,
        file: { name: fileName, path: dbFilePath, size: fileSize, type: fileType },
        host: "supabase-persistent",
      });
    }

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

    fs.renameSync(tempFilePath, finalPath);
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
