import type { NextConfig } from "next";

const isVercel = !!process.env.VERCEL;

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "5gb",
    },
  },
  // Vercel handles Next.js natively (no output), Docker/HF need standalone
  ...(isVercel ? {} : { output: "standalone" as const }),
  compress: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/uploads/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
