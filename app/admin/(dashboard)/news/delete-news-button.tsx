"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { deleteNewsArticle } from "./delete-action";

export default function DeleteNewsButton({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  const router = useRouter();

  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${title}"?`
    );

    if (!confirmed) {
      return;
    }

    setLoading(true);

    const result = await deleteNewsArticle(id);

    if (!result.success) {
      window.alert(
        result.message || "Failed to delete news article."
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
      {loading ? "Deleting..." : "Delete"}
    </button>
  );
}
