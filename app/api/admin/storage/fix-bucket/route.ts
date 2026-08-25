import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Attempts to bump winlator-releases bucket to 5GB.
// Works if SUPABASE_SERVICE_ROLE_KEY is set in env (server-only).
// Otherwise returns instructions to run SQL manually.
export async function POST() {
  try {
    const supabase = await createClient();

    // Verify admin auth
    const {
      data: claimsData,
      error: claimsError,
    } = await supabase.auth.getClaims();

    const claims = claimsData?.claims ?? null;

    if (claimsError || !claims) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You must be logged in as admin to fix bucket.",
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

    const { data: profile } =
      await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

    if (!profile || profile.role !== "admin") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Administrator permission required.",
        },
        { status: 403 }
      );
    }

    // Try RPC fix first (SECURITY DEFINER, works without service_role if SQL was run)
    // This is from supabase-external-url.sql: public.fix_winlator_bucket()
    try {
      const { data: rpcData, error: rpcError } =
        await supabase.rpc(
          "fix_winlator_bucket" as any
        );

      if (!rpcError && rpcData) {
        // RPC succeeded, verify bucket
        return NextResponse.json({
          success: true,
          message:
            "Bucket fixed via RPC to 5 GB successfully. Retry 239 MB upload.",
          data: rpcData,
        });
      }

      if (
        rpcError &&
        !rpcError.message
          ?.toLowerCase()
          .includes("could not find the function") &&
        !rpcError.message
          ?.toLowerCase()
          .includes("does not exist")
      ) {
        // RPC exists but failed for other reason, log and continue to other methods
        console.warn(
          "RPC fix_winlator_bucket error:",
          rpcError.message
        );
      } else if (rpcError) {
        console.log(
          "RPC not found, need to run supabase-external-url.sql to create it"
        );
      }
    } catch (e) {
      console.warn("RPC attempt failed", e);
    }

    // Try with service_role if available (server-only env)
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl) {
      return NextResponse.json(
        {
          success: false,
          message:
            "NEXT_PUBLIC_SUPABASE_URL missing.",
        },
        { status: 500 }
      );
    }

    // Attempt 2: try with service_role via direct Storage API
    // If service key missing, this will fail with permission error and we fallback to instructions
    if (serviceRoleKey) {
      const adminClient = createSupabaseClient(
        supabaseUrl,
        serviceRoleKey
      );

      // Try updateBucket
      const { error: updateError } =
        await adminClient.storage.updateBucket(
          "winlator-releases",
          {
            public: false,
            fileSizeLimit: 5368709120, // 5 GB
            allowedMimeTypes: [
              "application/vnd.android.package-archive",
              "application/octet-stream",
            ],
          }
        );

      if (!updateError) {
        // Verify
        const { data: bucket } =
          await adminClient.storage.getBucket(
            "winlator-releases"
          );

        return NextResponse.json({
          success: true,
          message:
            "Bucket 'winlator-releases' updated to 5 GB successfully.",
          bucket,
        });
      }

      // If bucket not found, try create
      if (
        updateError.message
          ?.toLowerCase()
          .includes("not found") ||
        updateError.message
          ?.toLowerCase()
          .includes("does not exist")
      ) {
        const { error: createError } =
          await adminClient.storage.createBucket(
            "winlator-releases",
            {
              public: false,
              fileSizeLimit: 5368709120,
              allowedMimeTypes: [
                "application/vnd.android.package-archive",
                "application/octet-stream",
              ],
            }
          );

        if (!createError) {
          return NextResponse.json({
            success: true,
            message:
              "Bucket 'winlator-releases' created with 5 GB limit.",
          });
        }

        return NextResponse.json(
          {
            success: false,
            message: `Service role failed to update/create bucket: ${createError.message}. Try SQL Editor method.`,
            hint: "Run supabase-bucket-5gb.sql in Dashboard SQL Editor.",
          },
          { status: 500 }
        );
      }

      // Other update error
      console.error(
        "Bucket update error with service_role:",
        updateError
      );

      // Fall through to SQL instructions
      return NextResponse.json(
        {
          success: false,
          message: `Bucket update failed: ${updateError.message}`,
          hint: "Run SQL in Supabase Dashboard: UPDATE storage.buckets SET file_size_limit = 5368709120 WHERE id='winlator-releases';",
          sqlFile: "supabase-bucket-5gb.sql",
        },
        { status: 500 }
      );
    }

    // No service_role key - return manual instructions
    // Also try to guide for RPC creation (supabase-external-url.sql)
    return NextResponse.json(
      {
        success: false,
        message:
          "SUPABASE_SERVICE_ROLE_KEY not configured on server. Manual SQL required. Also ensure RPC function exists.",
        instructions: [
          "1. Open https://supabase.com/dashboard/project/xcahjcxoacyxouvkcvcq",
          "2. Go to SQL Editor → New Query",
          "3. Paste and Run BOTH files (in order):",
          "   a) supabase-bucket-5gb.sql → UPDATE storage.buckets SET file_size_limit = 5368709120 WHERE id='winlator-releases';",
          "   b) supabase-external-url.sql → creates public.fix_winlator_bucket() RPC + external_url column (run entire file)",
          "4. Verify: SELECT file_size_limit/1024/1024/1024 AS gb FROM storage.buckets WHERE id='winlator-releases'; (should be 5)",
          "5. Verify RPC: SELECT public.fix_winlator_bucket();",
          "6. Alternative no-SQL: Storage → winlator-releases → Edit Bucket → File size limit → 5120 MB",
          "7. After SQL, retry 239 MB upload via TUS (6MB chunks, auto-retry). If still 413, use External URL field as workaround (paste direct link) and publish.",
          "8. For immediate workaround without SQL: In Create Release form, use 'External APK URL' field with direct link (R2, Drive, etc.) - will publish instantly.",
        ],
        sqlFiles: [
          "supabase-bucket-5gb.sql",
          "supabase-external-url.sql",
        ],
      },
      { status: 409 }
    );
  } catch (e) {
    console.error(
      "fix-bucket unexpected error",
      e
    );
    return NextResponse.json(
      {
        success: false,
        message:
          e instanceof Error
            ? e.message
            : "Unexpected error.",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Simple status check - returns current bucket info if service_role available
  try {
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({
        success: false,
        message:
          "Service role not configured - check via Dashboard SQL Editor",
        instructions:
          "Run supabase-bucket-5gb.sql to verify limit",
      });
    }

    const adminClient = createSupabaseClient(
      supabaseUrl,
      serviceRoleKey
    );

    const { data, error } =
      await adminClient.storage.getBucket(
        "winlator-releases"
      );

    if (error) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      bucket: data,
      limitGB:
        // @ts-ignore supabase types use snake_case file_size_limit
        (data as any).file_size_limit != null
          ? // @ts-ignore
            ((data as any).file_size_limit /
              1024 /
              1024 /
              1024).toFixed(2)
          : null,
    });
  } catch (e) {
    return NextResponse.json(
      {
        success: false,
        message:
          e instanceof Error
            ? e.message
            : "Error",
      },
      { status: 500 }
    );
  }
}
