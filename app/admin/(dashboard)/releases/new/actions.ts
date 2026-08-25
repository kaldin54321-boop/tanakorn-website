"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type CreateReleaseResult = {
  success: boolean;
  message?: string;
  releaseId?: string;
};

export async function createRelease(
  formData: FormData
): Promise<CreateReleaseResult> {
  const supabase = await createClient();

  // --------------------------------------------------
  // 1. Verify the logged-in user
  // --------------------------------------------------

  const {
    data: claimsData,
    error: claimsError,
  } = await supabase.auth.getClaims();

  const claims =
    claimsData?.claims ?? null;

  if (claimsError) {
    console.error(
      "Supabase claims error:",
      claimsError.message
    );

    return {
      success: false,
      message:
        "Unable to verify your administrator session.",
    };
  }

  if (!claims) {
    return {
      success: false,
      message:
        "You must be logged in as an administrator.",
    };
  }


  // --------------------------------------------------
  // 2. Get the authenticated user's ID
  // --------------------------------------------------

  const userId =
    typeof claims.sub === "string"
      ? claims.sub
      : null;

  if (!userId) {
    return {
      success: false,
      message:
        "Unable to determine your user ID.",
    };
  }


  // --------------------------------------------------
  // 3. Check the administrator profile
  // --------------------------------------------------

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle();


  if (profileError) {
    console.error(
      "Profile lookup error:",
      profileError.message
    );

    return {
      success: false,
      message:
        "Unable to verify your administrator profile.",
    };
  }


  if (
    !profile ||
    profile.role !== "admin"
  ) {
    return {
      success: false,
      message:
        "You do not have administrator permission.",
    };
  }


  // --------------------------------------------------
  // 4. Read release form data
  // --------------------------------------------------

  const version =
    String(
      formData.get("version") ?? ""
    ).trim();

  const name =
    String(
      formData.get("name") ?? ""
    ).trim();

  const status =
    String(
      formData.get("status") ?? ""
    ).trim();

  const visibility = String(
    formData.get("visibility") ?? "published"
  ).trim();

  const architecture =
    String(
      formData.get("architecture") ?? ""
    ).trim();

  const releaseDate =
    String(
      formData.get("release_date") ?? ""
    ).trim();

  const description =
    String(
      formData.get("description") ?? ""
    ).trim();

  const wineVersion =
    String(
      formData.get("wine_version") ?? ""
    ).trim();

  const androidVersion =
    String(
      formData.get("android_version") ?? ""
    ).trim();

  const externalUrlRaw =
    String(
      formData.get("external_url") ?? ""
    ).trim();

  let externalUrl: string | null = null;
  if (externalUrlRaw) {
    try {
      const u = new URL(externalUrlRaw);
      if (
        u.protocol !== "http:" &&
        u.protocol !== "https:"
      ) {
        return {
          success: false,
          message:
            "External URL must start with http:// or https://",
        };
      }
      externalUrl = externalUrlRaw;
    } catch {
      return {
        success: false,
        message: "External URL is not valid.",
      };
    }
  }


  // --------------------------------------------------
  // 5. Read uploaded APK metadata
  // --------------------------------------------------

  const fileNameValue =
    formData.get("file_name");

  const filePathValue =
    formData.get("file_path");

  const fileSizeValue =
    formData.get("file_size");

  const fileTypeValue =
    formData.get("file_type");


  const fileName =
    typeof fileNameValue === "string"
      ? fileNameValue.trim()
      : "";

  const filePath =
    typeof filePathValue === "string"
      ? filePathValue.trim()
      : "";

  const fileType =
    typeof fileTypeValue === "string"
      ? fileTypeValue.trim()
      : "";


  let fileSize: number | null = null;


  if (
    typeof fileSizeValue === "string" &&
    fileSizeValue.trim() !== ""
  ) {
    const parsedFileSize =
      Number(
        fileSizeValue
      );

    if (
      Number.isFinite(parsedFileSize) &&
      parsedFileSize >= 0
    ) {
      fileSize =
        Math.floor(parsedFileSize);
    }
  }


  // --------------------------------------------------
  // 6. Validate required release fields
  // --------------------------------------------------

  if (
    !version ||
    !name ||
    !status ||
    !architecture ||
    !releaseDate
  ) {
    return {
      success: false,
      message:
        "Please complete all required release fields.",
    };
  }


  // --------------------------------------------------
  // 7. Validate release status and visibility
  // --------------------------------------------------

  const validStatuses = [
    "stable",
    "beta",
    "experimental",
  ];

  if (!validStatuses.includes(status)) {
    return {
      success: false,
      message: "Invalid release status.",
    };
  }

  const validVisibilities = [
    "published",
    "draft",
  ];

  if (!validVisibilities.includes(visibility)) {
    return {
      success: false,
      message: "Invalid visibility.",
    };
  }


  // --------------------------------------------------
  // 8. Validate APK metadata vs external URL
  // --------------------------------------------------
  //
  // Allow either Supabase upload OR external URL (for 239MB+)
  // If external_url is provided, file metadata is optional

  const hasAnyFileMetadata =
    Boolean(
      fileName ||
      filePath ||
      fileType ||
      fileSize !== null
    );

  if (externalUrl && hasAnyFileMetadata) {
    return {
      success: false,
      message:
        "Use either uploaded APK or external URL, not both. Clear one.",
    };
  }


  if (hasAnyFileMetadata) {

    if (
      !fileName ||
      !filePath ||
      !fileType ||
      fileSize === null
    ) {
      return {
        success: false,
        message:
          "The uploaded APK information is incomplete. Please upload the APK again.",
      };
    }


    if (
      !fileName
        .toLowerCase()
        .endsWith(".apk")
    ) {
      return {
        success: false,
        message:
          "The uploaded file must be an APK.",
      };
    }


    if (!filePath) {
      return {
        success: false,
        message:
          "The APK storage path is missing.",
      };
    }


    if (fileSize <= 0) {
      return {
        success: false,
        message:
          "The APK file size is invalid.",
      };
    }
  }

  // If external URL provided, ensure no file metadata required
  // External URL can be used for 239MB+ files when bucket limit is 50MB


  // --------------------------------------------------
  // 9. Insert release
  // --------------------------------------------------

  const {
    data: release,
    error: insertError,
  } = await supabase
    .from("releases")
    .insert({
      version,
      name,
      status,
      visibility,
      architecture,
      release_date: releaseDate,

      description:
        description || null,

      wine_version:
        wineVersion || null,

      android_version:
        androidVersion || null,

      // --------------------------------------------
      // APK metadata / external URL
      // --------------------------------------------

      file_name:
        fileName || null,

      file_path:
        filePath || null,

      file_size:
        fileSize,

      file_type:
        fileType || null,

      external_url: externalUrl,
    })
    .select("id")
    .single();


  // --------------------------------------------------
  // 10. Return a readable database error
  // --------------------------------------------------

  if (insertError) {

    console.error(
      "===================================="
    );

    console.error(
      "WINLATOR@FROST RELEASE INSERT ERROR"
    );

    console.error(
      "Code:",
      insertError.code
    );

    console.error(
      "Message:",
      insertError.message
    );

    console.error(
      "Details:",
      insertError.details
    );

    console.error(
      "Hint:",
      insertError.hint
    );

    console.error(
      "===================================="
    );


    return {
      success: false,

      message: [
        `Code: ${insertError.code || "unknown"}`,

        `Message: ${
          insertError.message ||
          "Unknown database error"
        }`,

        insertError.details
          ? `Details: ${insertError.details}`
          : "",

        insertError.hint
          ? `Hint: ${insertError.hint}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }


  // --------------------------------------------------
  // 11. Revalidate synced pages
  // --------------------------------------------------

  revalidatePath("/");
  revalidatePath("/downloads");
  revalidatePath(`/downloads/${version}`);
  revalidatePath("/admin");
  revalidatePath("/admin/releases");

  // --------------------------------------------------
  // 12. Success
  // --------------------------------------------------

  return {
    success: true,
    releaseId: release.id,
  };
}