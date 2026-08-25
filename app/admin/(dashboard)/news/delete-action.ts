"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function deleteNewsArticle(id: string) {
  const supabase = await createClient();

  const {
    data: claimsData,
    error: claimsError,
  } = await supabase.auth.getClaims();

  const claims = claimsData?.claims ?? null;

  if (claimsError || !claims) {
    return {
      success: false,
      message: "Administrator login required.",
    };
  }

  const userId =
    typeof claims.sub === "string"
      ? claims.sub
      : null;

  if (!userId) {
    return {
      success: false,
      message: "Unable to identify user.",
    };
  }

  const { data: profile } =
    await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

  if (!profile || profile.role !== "admin") {
    return {
      success: false,
      message: "Administrator permission required.",
    };
  }

  // Fetch slug before delete for revalidation
  const {
    data: existingArticle,
  } = await supabase
    .from("news")
    .select("slug")
    .eq("id", id)
    .maybeSingle();

  const slug =
    (existingArticle as { slug?: string } | null)
      ?.slug ?? null;

  const { error } = await supabase
    .from("news")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("DELETE NEWS ERROR:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });

    return {
      success: false,
      message: [
        `Code: ${error.code || "unknown"}`,
        `Message: ${error.message || "Unknown error"}`,
        error.details
          ? `Details: ${error.details}`
          : "",
        error.hint ? `Hint: ${error.hint}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }

  revalidatePath("/");
  revalidatePath("/news");
  if (slug) {
    revalidatePath(`/news/${slug}`);
  }
  revalidatePath("/admin");
  revalidatePath("/admin/news");
  if (id) {
    revalidatePath(`/admin/news/${id}`);
  }

  return {
    success: true,
  };
}
