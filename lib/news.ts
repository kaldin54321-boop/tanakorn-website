import { createClient } from "@/lib/supabase/server";


export type NewsArticle = {
  id: string;

  title: string;

  slug: string;

  excerpt: string | null;

  content: string;

  category: string;

  image_url: string | null;

  published: boolean;

  published_at: string | null;

  created_at: string;

  updated_at: string;
};


/* =========================================================
   GET PUBLIC NEWS
   ========================================================= */

export async function getPublicNews() {

  const supabase =
    await createClient();


  const {
    data,
    error,
  } =
    await supabase
      .from("news")
      .select("*")
      .eq(
        "published",
        true
      )
      .order(
        "published_at",
        {
          ascending: false,
        }
      );


  if (error) {

    console.error(
      "Failed to load news:",
      {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      }
    );


    return [];
  }


  return (
    data as NewsArticle[] | null
  ) ?? [];
}


/* =========================================================
   GET SINGLE PUBLIC NEWS ARTICLE
   ========================================================= */

export async function getPublicNewsArticle(
  slug: string
) {

  const supabase =
    await createClient();


  const {
    data,
    error,
  } =
    await supabase
      .from("news")
      .select("*")
      .eq(
        "slug",
        slug
      )
      .eq(
        "published",
        true
      )
      .maybeSingle();


  if (error) {

    console.error(
      "Failed to load news article:",
      {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      }
    );


    return null;
  }


  return (
    data as NewsArticle | null
  );
}

/* =========================================================
   GET ADMIN NEWS ARTICLE BY ID
   ========================================================= */

export async function getAdminNewsArticle(
  id: string
) {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } =
    await supabase
      .from("news")
      .select("*")
      .eq(
        "id",
        id
      )
      .maybeSingle();

  if (error) {

    console.error(
      "Failed to load admin news article:",
      {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      }
    );

    return null;
  }

  return (
    data as NewsArticle | null
  );
}

/* =========================================================
   GET ADMIN NEWS
   ========================================================= */

export async function getAdminNews() {

  const supabase =
    await createClient();


  const {
    data,
    error,
  } =
    await supabase
      .from("news")
      .select("*")
      .order(
        "created_at",
        {
          ascending: false,
        }
      );


  if (error) {

    console.error(
      "Failed to load admin news:",
      {
        code:
          error.code,

        message:
          error.message,

        details:
          error.details,

        hint:
          error.hint,
      }
    );


    return [];
  }


  return (
    data as NewsArticle[] | null
  ) ?? [];
}