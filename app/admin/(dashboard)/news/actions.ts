"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";


export async function createNewsArticle(
  formData: FormData
) {

  // ==========================================
  // Get form values
  // ==========================================

  const title =
    String(
      formData.get("title") ?? ""
    ).trim();

  const slug =
    String(
      formData.get("slug") ?? ""
    ).trim();

  const category =
    String(
      formData.get("category") ?? ""
    ).trim();

  const excerpt =
    String(
      formData.get("excerpt") ?? ""
    ).trim();

  const content =
    String(
      formData.get("content") ?? ""
    ).trim();

  const imageUrl =
    String(
      formData.get("image_url") ?? ""
    ).trim();

  const published =
    String(
      formData.get("published") ?? "false"
    ) === "true";


  // ==========================================
  // Basic validation
  // ==========================================

  if (!title) {
    throw new Error(
      "Article title is required."
    );
  }


  if (!slug) {
    throw new Error(
      "Article slug is required."
    );
  }


  if (!category) {
    throw new Error(
      "Article category is required."
    );
  }


  if (!content) {
    throw new Error(
      "Article content is required."
    );
  }


  // ==========================================
  // Create Supabase client
  // ==========================================

  const supabase =
    await createClient();


  // ==========================================
  // Check whether slug already exists
  // ==========================================

  const {
    data: existingArticle,
    error: slugCheckError,
  } =
    await supabase
      .from("news")
      .select("id")
      .eq(
        "slug",
        slug
      )
      .maybeSingle();


  if (slugCheckError) {

    console.error(
      "Failed to check news slug:",
      slugCheckError
    );

    throw new Error(
      "Unable to validate article slug."
    );
  }


  if (existingArticle) {

    throw new Error(
      "An article with this slug already exists."
    );
  }


  // ==========================================
  // Publication date
  // ==========================================

  const publishedAt =
    published
      ? new Date().toISOString()
      : null;


  // ==========================================
  // Insert article
  // ==========================================

  const {
    error,
  } =
    await supabase
      .from("news")
      .insert({
        title,
        slug,
        excerpt:
          excerpt || null,
        content,
        category,
        image_url:
          imageUrl || null,
        published,
        published_at:
          publishedAt,
        updated_at:
    new Date().toISOString(),
      });


  if (error) {
  throw new Error(
    `SUPABASE INSERT ERROR: ${error.message} | CODE: ${error.code} | DETAILS: ${error.details ?? "none"} | HINT: ${error.hint ?? "none"}`
  );
}


  // ==========================================
  // Refresh public news pages
  // ==========================================

  revalidatePath(
    "/news"
  );

  revalidatePath(
    `/news/${slug}`
  );

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/news");


  // ==========================================
  // Return to News management
  // ==========================================

  redirect(
    "/admin/news"
  );
}

/* =========================================================
   UPDATE NEWS ARTICLE
   ========================================================= */

export async function updateNewsArticle(
  formData: FormData
) {

  // ==========================================
  // Get form values
  // ==========================================

  const id =
    String(
      formData.get("id") ?? ""
    ).trim();

  const title =
    String(
      formData.get("title") ?? ""
    ).trim();

  const slug =
    String(
      formData.get("slug") ?? ""
    ).trim();

  const category =
    String(
      formData.get("category") ?? ""
    ).trim();

  const excerpt =
    String(
      formData.get("excerpt") ?? ""
    ).trim();

  const content =
    String(
      formData.get("content") ?? ""
    ).trim();

  const imageUrl =
    String(
      formData.get("image_url") ?? ""
    ).trim();

  const published =
    String(
      formData.get("published") ?? "false"
    ) === "true";


  // ==========================================
  // Basic validation
  // ==========================================

  if (!id) {
    throw new Error(
      "Article ID is required."
    );
  }


  if (!title) {
    throw new Error(
      "Article title is required."
    );
  }


  if (!slug) {
    throw new Error(
      "Article slug is required."
    );
  }


  if (!category) {
    throw new Error(
      "Article category is required."
    );
  }


  if (!content) {
    throw new Error(
      "Article content is required."
    );
  }


  // ==========================================
  // Create Supabase client
  // ==========================================

  const supabase =
    await createClient();


  // ==========================================
  // Check whether another article
  // already uses this slug
  // ==========================================

  const {
    data: existingArticle,
    error: slugCheckError,
  } =
    await supabase
      .from("news")
      .select("id")
      .eq(
        "slug",
        slug
      )
      .neq(
        "id",
        id
      )
      .maybeSingle();


  if (slugCheckError) {

    console.error(
      "Failed to check news slug:",
      slugCheckError
    );

    throw new Error(
      "Unable to validate article slug."
    );
  }


  if (existingArticle) {

    throw new Error(
      "Another article with this slug already exists."
    );
  }


  // ==========================================
  // Get current article
  // ==========================================

  const {
    data: currentArticle,
    error: currentArticleError,
  } =
    await supabase
      .from("news")
      .select(
        "published, published_at"
      )
      .eq(
        "id",
        id
      )
      .maybeSingle();


  if (currentArticleError) {

    console.error(
      "Failed to load current news article:",
      currentArticleError
    );

    throw new Error(
      "Unable to load the current article."
    );
  }


  if (!currentArticle) {

    throw new Error(
      "News article not found."
    );
  }


  // ==========================================
  // Publication date
  // ==========================================

  let publishedAt =
    currentArticle.published_at;


  /*
   * Draft → Published
   *
   * Create a publication date.
   */

  if (
    published &&
    !currentArticle.published
  ) {

    publishedAt =
      new Date().toISOString();
  }


  /*
   * Published → Draft
   *
   * Remove the publication date.
   */

  if (!published) {

    publishedAt = null;
  }


// ==========================================
// Update article
// ==========================================

const {
  error: updateError,
} =
  await supabase
    .from("news")
    .update({
      title,
      slug,
      excerpt:
        excerpt || null,
      content,
      category,
      image_url:
        imageUrl || null,
      published,
      published_at:
        publishedAt,
      updated_at:
        new Date().toISOString(),
    })
    .eq(
      "id",
      id
    );


if (updateError) {

  console.error(
    "NEWS UPDATE ERROR",
    {
      code:
        updateError.code,

      message:
        updateError.message,

      details:
        updateError.details,

      hint:
        updateError.hint,
    }
  );


  throw new Error(
    `SUPABASE UPDATE ERROR: ${updateError.message} | CODE: ${updateError.code} | DETAILS: ${updateError.details ?? "none"} | HINT: ${updateError.hint ?? "none"}`
  );
}


  // ==========================================
  // Refresh public news pages
  // ==========================================

  // Refresh news listing
  revalidatePath("/news");

  // Refresh admin listing
  revalidatePath("/admin/news");

  revalidatePath("/");
  revalidatePath("/admin");

  // Refresh edit page
  revalidatePath(`/admin/news/${id}`);

  // Refresh new article URL
  revalidatePath(`/news/${slug}`);

  // Refresh old article URL (if slug changed)
  const oldSlug = String(
    formData.get("old_slug") ?? ""
  );

  if (oldSlug && oldSlug !== slug) {
    revalidatePath(`/news/${oldSlug}`);
  }


  // ==========================================
  // Return to News management
  // ==========================================

  redirect(
    "/admin/news"
  );
}