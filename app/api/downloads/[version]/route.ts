import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

import fs from "fs";
import path from "path";

import { getS3SignedUrl } from "@/lib/storage-s3";

type RouteContext = {
  params: Promise<{
    version: string;
  }>;
};

function isLocalPath(p: string): boolean {
  return (
    p.startsWith("uploads/") ||
    p.startsWith("uploads\\") ||
    p.includes("uploads/releases")
  );
}

function getLocalFilePath(dbPath: string): string {
  // Check all possible local locations: HF /data, Render /tmp, and local ./uploads
  // Upload saves to /tmp on Render, /data on HF, ./uploads locally
  const candidates = [
    path.join(/*turbopackIgnore: true*/ "/data", dbPath),
    path.join(/*turbopackIgnore: true*/ "/tmp", dbPath),
    path.join(/*turbopackIgnore: true*/ process.cwd(), dbPath),
    path.join(/*turbopackIgnore: true*/ "/app", dbPath),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  // Default to /tmp on Render, /data on HF, or cwd
  if (process.env.RENDER || process.env.RENDER_SERVICE_ID) {
    return path.join(/*turbopackIgnore: true*/ "/tmp", dbPath);
  }
  if (fs.existsSync("/data")) {
    return path.join(/*turbopackIgnore: true*/ "/data", dbPath);
  }
  return path.join(/*turbopackIgnore: true*/ process.cwd(), dbPath);
}

export async function GET(
  request: Request,
  context: RouteContext
) {
  try {
    const { version: rawVersion } =
      await context.params;

    const version =
      decodeURIComponent(rawVersion);

    if (!version) {
      return NextResponse.json(
        {
          success: false,
          message: "Release version is required.",
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const {
      data: release,
      error: releaseError,
    } = (await supabase
      .from("releases")
      .select(
        `
            id,
            version,
            file_name,
            file_path,
            file_type,
            file_size,
            external_url
          `
      )
      .eq("version", version)
      .maybeSingle()) as {
      data: {
        id: string;
        version: string;
        file_name: string | null;
        file_path: string | null;
        file_type: string | null;
        file_size: number | null;
        external_url: string | null;
      } | null;
      error: any;
    };

    if (releaseError) {
      console.error(
        "Release lookup error:",
        releaseError
      );
      return NextResponse.json(
        {
          success: false,
          message: "Unable to find the requested release.",
        },
        { status: 500 }
      );
    }

    if (!release) {
      return NextResponse.json(
        {
          success: false,
          message: "Release not found.",
        },
        { status: 404 }
      );
    }

    // External URL takes precedence (for 239MB+ on Render Free ephemeral)
    if (release.external_url) {
      return NextResponse.redirect(release.external_url);
    }

    if (!release.file_path) {
      return NextResponse.json(
        {
          success: false,
          message: "APK file is not available for this release.",
        },
        { status: 404 }
      );
    }

    // S3-compatible own host (Storj/Filebase/R2) - persistent, 5GB, not PC-dependent, not Supabase 50MB
    // file_path like s3://11.10/app.apk
    if (release.file_path.startsWith("s3://")) {
      const s3Key = release.file_path.slice(5);
      const signedUrl = await getS3SignedUrl(s3Key, 600);
      if (signedUrl) {
        return NextResponse.redirect(signedUrl);
      }
      return NextResponse.json(
        { success: false, message: "Unable to prepare S3 download URL. Check S3_* env." },
        { status: 500 }
      );
    }

    // Check if local file host (self-hosted, separate from Supabase)
    // On Render Free, /app/uploads is ephemeral (lost on redeploy) - old 11.10 file was on your PC's uploads/ and not migrated
    if (isLocalPath(release.file_path)) {
      const absPath = getLocalFilePath(
        release.file_path
      );

      if (!fs.existsSync(absPath)) {
        console.error(
          "Local file not found (Render ephemeral or not yet uploaded to Filebase):",
          absPath,
          "file_path:", release.file_path
        );

        // For Filebase/S3 host, file_path is s3:// - already handled above, this is only for uploads/ local path
        // Try Supabase legacy only if file_path looks like Supabase path (no uploads/ prefix) - but per user request, APKs should NOT use Supabase bucket
        // So do NOT fallback to Supabase for APKs - only for legacy if needed, otherwise 404 with Filebase hint

        // Fallback: HF persistent /data (if file was ever on HF)
        const hfPath = path.join("/data", release.file_path);
        if (fs.existsSync(hfPath)) {
          console.log("Fallback to HF /data found:", hfPath);
          const stat = fs.statSync(hfPath);
          const fileSize = stat.size;
          const fileName = release.file_name || path.basename(hfPath);
          const contentType = release.file_type || "application/vnd.android.package-archive";
          const stream = fs.createReadStream(hfPath);
          const webStream = new ReadableStream({
            start(controller) {
              stream.on("data", (chunk) => controller.enqueue(chunk));
              stream.on("end", () => controller.close());
              stream.on("error", (err) => controller.error(err));
            },
            cancel() { stream.destroy(); },
          });
          return new Response(webStream as any, {
            headers: {
              "Content-Length": fileSize.toString(),
              "Content-Type": contentType,
              "Content-Disposition": `attachment; filename="${fileName}"`,
              "Accept-Ranges": "bytes",
              "Cache-Control": "public, max-age=3600",
            },
          });
        }

        return NextResponse.json(
          {
            success: false,
            message:
              "APK file not found. File was on previous local host (PC uploads/ lost on Render redeploy). Re-upload via Admin → Releases on https://winlator-frost.onrender.com - now goes to Filebase S3 5GB (persistent, not Supabase 50MB, not PC-dependent). For 239MB+, ensure Filebase env is set on Render.",
            file_path: release.file_path,
            hint: "Set Filebase S3 env on Render: S3_ENDPOINT=https://s3.filebase.com, S3_BUCKET=winlator-releases, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, then re-upload APK. Or use External APK URL field.",
          },
          { status: 404 }
        );
      }

      const stat = fs.statSync(absPath);
      const fileSize = stat.size;
      const fileName =
        release.file_name ||
        path.basename(absPath);
      const contentType =
        release.file_type ||
        "application/vnd.android.package-archive";

      const range = request.headers.get("range");

      if (range) {
        // Parse Range: bytes=0-1023 or bytes=1024-
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1]
          ? parseInt(parts[1], 10)
          : fileSize - 1;
        const chunkSize = end - start + 1;

        const stream = fs.createReadStream(
          absPath,
          { start, end }
        );

        // Convert Node stream to Web stream
        const webStream = new ReadableStream({
          start(controller) {
            stream.on("data", (chunk) =>
              controller.enqueue(chunk)
            );
            stream.on("end", () =>
              controller.close()
            );
            stream.on("error", (err) =>
              controller.error(err)
            );
          },
          cancel() {
            stream.destroy();
          },
        });

        return new Response(webStream as any, {
          status: 206,
          headers: {
            "Content-Range": `bytes ${start}-${end}/${fileSize}`,
            "Accept-Ranges": "bytes",
            "Content-Length": chunkSize.toString(),
            "Content-Type": contentType,
            "Content-Disposition": `attachment; filename="${fileName}"`,
            "Cache-Control": "public, max-age=3600",
          },
        });
      }

      // No Range - full file
      const stream = fs.createReadStream(absPath);
      const webStream = new ReadableStream({
        start(controller) {
          stream.on("data", (chunk) =>
            controller.enqueue(chunk)
          );
          stream.on("end", () => controller.close());
          stream.on("error", (err) =>
            controller.error(err)
          );
        },
        cancel() {
          stream.destroy();
        },
      });

      return new Response(webStream as any, {
        headers: {
          "Content-Length": fileSize.toString(),
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${fileName}"`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    // No local and no S3 and no external_url - file not found
    // Do NOT fallback to Supabase for APKs per user request (Supabase 50MB limit, kept only for news)
    // This is likely a legacy Supabase path like "11.10/file.apk" from before Filebase migration
    // User should re-upload to Filebase via Admin
    return NextResponse.json(
      {
        success: false,
        message: `APK file not found: ${release.file_path}. Supabase bucket is no longer used for APKs (50MB limit). Re-upload via Admin → Releases → Filebase S3 5GB (persistent). Ensure Render env has S3_* for Filebase bucket winlator-releases (https://s3.filebase.com).`,
      },
      { status: 404 }
    );
  } catch (error) {
    console.error(
      "Unexpected APK download error:",
      error
    );
    return NextResponse.json(
      {
        success: false,
        message: "Unexpected server error.",
      },
      { status: 500 }
    );
  }
}
