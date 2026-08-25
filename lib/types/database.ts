export type ReleaseStatus =
  | "stable"
  | "beta"
  | "experimental";


export interface Release {
  id: string;

  version: string;

  name: string;

  status: ReleaseStatus;

  architecture: string;

  release_date: string;

  description: string | null;

  wine_version: string | null;

  android_version: string | null;

  file_name: string | null;

  file_path: string | null;

  file_size: number | null;

  file_type: string | null;

  visibility: string | null;

  external_url: string | null;

  sha256?: string | null;

  download_count?: number | null;

  created_at: string;

  updated_at: string;
}