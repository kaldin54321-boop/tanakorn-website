import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

import fs from "fs";
import path from "path";

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
  // HF Spaces persistent is /data, local/Oracle is process.cwd()/uploads
  // Try /data first (HF), then fallback
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

    // External URL takes precedence
    if (release.external_url) {
      return NextResponse.redirect(
        release.external_url
      );
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

    // Check if local file host (self-hosted, separate from Supabase)
    // On Render Free, /app/uploads is ephemeral (lost on redeploy) - old 11.10 file was on your PC's uploads/ and not migrated
    if (isLocalPath(release.file_path)) {
      const absPath = getLocalFilePath(
        release.file_path
      );

      if (!fs.existsSync(absPath)) {
        console.error(
          "Local file not found (ephemeral Render disk, not migrated from old host):",
          absPath,
          "file_path:", release.file_path
        );

        // Fallback: try Supabase storage if file was previously on Supabase (legacy)
        // Try to get signed URL from Supabase as fallback for old releases before local host migration
        try {
          const { data: fallbackUrl, error: fallbackError } =
            await supabase.storage
              .from("winlator-releases")
              .createSignedUrl(release.file_path, 60 * 10);
          if (!fallbackError && fallbackUrl?.signedUrl) {
            console.log("Fallback to Supabase succeeded for", release.file_path);
            return NextResponse.redirect(fallbackUrl.signedUrl);
          }
        } catch (e) {
          console.warn("Fallback Supabase also failed for", release.file_path, e);
        }

        // Also check if file exists on HF persistent /data (if migrated from HF)
        const hfPath = path.join("/data", release.file_path);
        if (fs.existsSync(hfPath)) {
          console.log("Fallback to HF /data found:", hfPath);
          // Serve from HF path
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
              "APK file not found on server (Render Free disk is ephemeral - old uploads from your PC were not migrated to new host). Please re-upload via Admin → Releases → External APK URL (for 239MB+) or re-upload the APK on the live site. For persistent 5GB on Render, use External URL (R2, etc.) or upgrade to Render Starter with Disk.",
            file_path: release.file_path,
            hint: "Re-upload the 11.10 APK via https://winlator-frost.onrender.com/admin/releases - use External URL field for 235MB on Render Free",
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

    // Fallback: Supabase storage (legacy, for news still uses Supabase)
    const {
      data: signedUrlData,
      error: signedUrlError,
    } = await supabase.storage
      .from("winlator-releases")
      .createSignedUrl(release.file_path, 60 * 10);

    if (signedUrlError) {
      console.error(
        "Failed to create APK signed URL:",
        signedUrlError
      );
      return NextResponse.json(
        {
          success: false,
          message: "Unable to prepare the APK download.",
        },
        { status: 500 }
      );
    }

    if (!signedUrlData?.signedUrl) {
      return NextResponse.json(
        {
          success: false,
          message: "Unable to generate the APK download URL.",
        },
        { status: 500 }
      );
    }

    return NextResponse.redirect(
      signedUrlData.signedUrl
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
