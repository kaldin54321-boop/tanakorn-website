import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import EditReleaseForm from "./edit-release-form";


export async function generateStaticParams() {
  return [{ id: "placeholder" }];
}

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};


export default async function EditReleasePage({
  params,
}: PageProps) {

  // Next.js 16 provides dynamic route params
  // as a Promise.

  const resolvedParams =
    await params;

  const id =
    resolvedParams?.id;


  // Make sure the ID actually exists.

  if (!id) {
    notFound();
  }


  const supabase =
    await createClient();


  const {
    data: release,
    error,
  } = await supabase
    .from("releases")
    .select("*")
    .eq("id", id)
    .single();


  if (error || !release) {
    console.error(
      "Failed to load release:",
      {
        code: error?.code,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
      }
    );

    notFound();
  }


  return (
    <div className="admin-page">

      <div className="admin-page-header">

        <div>

          <p className="admin-eyebrow">
            WINLATOR@FROST
          </p>

          <h1>
            Edit Release
          </h1>

          <p className="admin-page-description">
            Update the information for{" "}
            <strong>
              {release.name}
            </strong>
          </p>

        </div>


        <Link
          href="/admin/releases"
          className="button-secondary"
        >
          ← Back to Releases
        </Link>

      </div>


      <EditReleaseForm
        release={release}
      />

    </div>
  );
}