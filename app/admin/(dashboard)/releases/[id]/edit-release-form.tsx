"use client";

import {
  FormEvent,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import {
  updateRelease,
} from "./actions";


type Release = {
  id: string;
  version: string;
  name: string;
  status: string;
  architecture: string;
  release_date: string;
  description: string | null;
  wine_version: string | null;
  android_version: string | null;
};


type EditReleaseFormProps = {
  release: Release;
};


export default function EditReleaseForm({
  release,
}: EditReleaseFormProps) {

  const router =
    useRouter();


  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");


  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {

    event.preventDefault();

    setLoading(true);
    setError("");


    const formData =
      new FormData(
        event.currentTarget
      );


    try {

      const result =
        await updateRelease(
          release.id,
          formData
        );


      if (!result.success) {

        setError(
          result.message ||
          "Failed to update release."
        );

        setLoading(false);

        return;
      }


      router.push(
        "/admin/releases"
      );

      router.refresh();

    } catch (error) {

      console.error(
        "Unexpected update error:",
        error
      );

      setError(
        "An unexpected error occurred while updating the release."
      );

      setLoading(false);
    }
  }


  return (
    <form
      onSubmit={handleSubmit}
      className="admin-form"
    >

      {/* -------------------------------- */}
      {/* Release Information              */}
      {/* -------------------------------- */}

      <div className="admin-form-section">

        <h2>
          Release Information
        </h2>


        <div className="form-grid">

          <label>
            Version

            <input
              name="version"
              type="text"
              defaultValue={
                release.version
              }
              required
            />
          </label>


          <label>
            Release Name

            <input
              name="name"
              type="text"
              defaultValue={
                release.name
              }
              required
            />
          </label>


          <label>
            Status

            <select
              name="status"
              defaultValue={
                release.status
              }
            >

              <option value="stable">
                Stable
              </option>

              <option value="beta">
                Beta
              </option>

              <option value="experimental">
                Experimental
              </option>

            </select>

          </label>


          <label>
            Architecture

            <input
              name="architecture"
              type="text"
              defaultValue={
                release.architecture
              }
              required
            />
          </label>


          <label>
            Release Date

            <input
              name="release_date"
              type="date"
              defaultValue={
                release.release_date
                  ? release.release_date.substring(
                      0,
                      10
                    )
                  : ""
              }
              required
            />
          </label>


          <label>
            Wine Version

            <input
              name="wine_version"
              type="text"
              defaultValue={
                release.wine_version ??
                ""
              }
              placeholder="Wine 10.x"
            />
          </label>


          <label>
            Android Version

            <input
              name="android_version"
              type="text"
              defaultValue={
                release.android_version ??
                ""
              }
              placeholder="Android 10+"
            />
          </label>

        </div>

      </div>


      {/* -------------------------------- */}
      {/* Description                      */}
      {/* -------------------------------- */}

      <div className="admin-form-section">

        <h2>
          Description
        </h2>


        <label>

          Release Description

          <textarea
            name="description"
            defaultValue={
              release.description ??
              ""
            }
            rows={8}
            placeholder="Describe the changes and improvements in this release..."
          />

        </label>

      </div>


      {/* -------------------------------- */}
      {/* Error                            */}
      {/* -------------------------------- */}

      {error && (
        <div
          className="admin-error"
          style={{
            whiteSpace:
              "pre-line",
          }}
        >
          {error}
        </div>
      )}


      {/* -------------------------------- */}
      {/* Buttons                          */}
      {/* -------------------------------- */}

      <div className="admin-form-actions">

        <button
          type="button"
          className="button-secondary"
          disabled={loading}
          onClick={() =>
            router.push(
              "/admin/releases"
            )
          }
        >
          Cancel
        </button>


        <button
          type="submit"
          className="button-primary"
          disabled={loading}
        >
          {loading
            ? "Saving..."
            : "Save Changes"}
        </button>

      </div>

    </form>
  );
}