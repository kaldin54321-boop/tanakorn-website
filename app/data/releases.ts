export interface ReleaseFile {
  name: string;
  type: string;
  architecture: string;
  size: string;
  checksum: string;
  downloadUrl: string | null;
}

export interface Release {
  version: string;
  status: string;
  date: string;
  architecture: string;
  description: string;

  wineVersion: string;
  androidVersion: string;

  requirements: string[];

  changes: string[];

  files: ReleaseFile[];
}

export const releases: Release[] = [
  {
    version: "11.1",

    status: "STABLE",

    date: "August 22, 2026",

    architecture: "ARM64",

    description:
      "Latest Winlator@Frost stable release.",

    wineVersion:
      "Wine 10.x",

    androidVersion:
      "Android 10 or newer",

    requirements: [
      "64-bit ARM Android device",
      "Android 10 or newer",
      "At least 4 GB RAM recommended",
      "Sufficient storage space",
    ],

    changes: [
      "Updated Frost components",
      "Performance improvements",
      "Compatibility improvements",
      "Additional configuration options",
    ],

    files: [
      {
        name:
          "Winlator-Frost-11.1.apk",

        type:
          "Android APK",

        architecture:
          "ARM64",

        size:
          "Coming soon",

        checksum:
          "Coming soon",

        downloadUrl:
          null,
      },
    ],
  },

  {
    version: "11.0",

    status: "STABLE",

    date: "July 20, 2026",

    architecture: "ARM64",

    description:
      "Previous Winlator@Frost stable release.",

    wineVersion:
      "Wine 10.x",

    androidVersion:
      "Android 10 or newer",

    requirements: [
      "64-bit ARM Android device",
      "Android 10 or newer",
      "At least 4 GB RAM recommended",
    ],

    changes: [
      "Updated Wine components",
      "Graphics improvements",
      "Performance improvements",
    ],

    files: [
      {
        name:
          "Winlator-Frost-11.0.apk",

        type:
          "Android APK",

        architecture:
          "ARM64",

        size:
          "Coming soon",

        checksum:
          "Coming soon",

        downloadUrl:
          null,
      },
    ],
  },
];