"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type UpdateReleaseResult = {
  success: boolean;
  message?: string;
};


async function verifyAdmin() {
  const supabase = await createClient();

  const {
    data: claimsData,
    error: claimsError,
  } = await supabase.auth.getClaims();

  const claims =
    claimsData?.claims ?? null;

  if (claimsError || !claims) {
    return {
      success: false,
      message:
        "You must be logged in as an administrator.",
      supabase,
    };
  }

  const userId =
    typeof claims.sub === "string"
      ? claims.sub
      : null;

  if (!userId) {
    return {
      success: false,
      message:
        "Unable to determine the authenticated user.",
      supabase,
    };
  }

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
    return {
      success: false,
      message:
        "Administrator permission required.",
      supabase,
    };
  }

  return {
    success: true,
    supabase,
  };
}


export async function updateRelease(
  id: string,
  formData: FormData
): Promise<UpdateReleaseResult> {

  const auth =
    await verifyAdmin();

  if (!auth.success) {
    return {
      success: false,
      message: auth.message,
    };
  }

  const supabase =
    auth.supabase;


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
  } else if (formData.has("external_url")) {
    // Field present but empty => clear external_url
    externalUrl = null;
  }


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
        "Please complete all required fields.",
    };
  }


  const validStatuses = [
    "stable",
    "beta",
    "experimental",
  ];

  if (!validStatuses.includes(status)) {
    return {
      success: false,
      message:
        "Invalid release status.",
    };
  }


  // Only include external_url in update if field was submitted
  const updatePayload: Record<string, any> = {
    version,
    name,
    status,
    architecture,
    release_date: releaseDate,
    description: description || null,
    wine_version: wineVersion || null,
    android_version: androidVersion || null,
  };
  if (formData.has("external_url")) {
    updatePayload.external_url = externalUrl;
  }

  const {
    error,
  } = await supabase
    .from("releases")
    .update(updatePayload)
    .eq("id", id);


  if (error) {
    console.error(
      "UPDATE RELEASE ERROR:",
      {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      }
    );

    return {
      success: false,
      message: [
        `Code: ${error.code || "unknown"}`,
        `Message: ${error.message || "Unknown error"}`,
        error.details
          ? `Details: ${error.details}`
          : "",
        error.hint
          ? `Hint: ${error.hint}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }

  revalidatePath("/");
  revalidatePath("/downloads");
  revalidatePath(`/downloads/${version}`);
  revalidatePath("/admin");
  revalidatePath("/admin/releases");
  revalidatePath(`/admin/releases/${id}`);

  return {
    success: true,
  };
}