import { createServerClient } from "@supabase/ssr";
import {
  NextResponse,
  type NextRequest,
} from "next/server";


export async function updateSession(
  request: NextRequest
) {
  // Cloudflare Pages (opennext) uses Edge runtime - Supabase SSR needs Node
  // For Pages, skip Supabase session refresh and just pass through
  // News stays on Supabase, but auth check for admin is handled via cookies + client
  if (
    process.env.CF_PAGES ||
    process.env.CLOUDFLARE_PAGES ||
    (typeof (globalThis as any).caches !== "undefined" &&
      typeof (globalThis as any).Deno === "undefined")
  ) {
    // On Cloudflare Workers/Pages, just pass through - admin auth will be checked via server component cookies
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({
    request,
  });


  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(
            ({ name, value }) => {
              request.cookies.set(
                name,
                value
              );
            }
          );

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(
            ({ name, value, options }) => {
              response.cookies.set(
                name,
                value,
                options
              );
            }
          );
        },
      },
    }
  );


  /*
   * Ask Supabase to refresh/validate the
   * current authentication session.
   *
   * IMPORTANT:
   * Do not destructure data.claims directly.
   * data can be null when there is no session.
   */

  const {
    data,
    error,
  } = await supabase.auth.getClaims();


  const claims =
    data?.claims ?? null;


  /*
   * If there is an authentication error,
   * treat the visitor as unauthenticated.
   */

  if (error) {
    console.warn(
      "Supabase authentication check:",
      error.message
    );
  }


  const pathname =
    request.nextUrl.pathname;


  const isAdminRoute =
    pathname.startsWith("/admin");


  const isLoginPage =
    pathname === "/admin/login";


  /*
   * Protect the administrator area.
   *
   * /admin/login remains publicly accessible.
   *
   * Everything else under /admin requires
   * a valid Supabase Auth session.
   */

  if (
    isAdminRoute &&
    !isLoginPage &&
    !claims
  ) {
    const loginUrl =
      request.nextUrl.clone();

    loginUrl.pathname =
      "/admin/login";

    loginUrl.searchParams.set(
      "redirect",
      pathname
    );

    return NextResponse.redirect(
      loginUrl
    );
  }


  return response;
}