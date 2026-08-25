"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { deleteRelease } from "./delete-action";


export default function DeleteReleaseButton({
  id,
  name,
}: {
  id: string;
  name: string;
}) {

  const router = useRouter();

  const [loading, setLoading] =
    useState(false);


  async function handleDelete() {

    const confirmed =
      window.confirm(
        `Are you sure you want to delete "${name}"?`
      );


    if (!confirmed) {
      return;
    }


    setLoading(true);


    const result =
      await deleteRelease(id);


    if (!result.success) {

      window.alert(
        result.message ||
        "Failed to delete release."
      );

      setLoading(false);

      return;
    }


    router.refresh();

    setLoading(false);
  }


  return (
    <button
      type="button"
      className="button-danger"
      onClick={handleDelete}
      disabled={loading}
    >
      {loading
        ? "Deleting..."
        : "Delete"}
    </button>
  );
}