import type { NextConfig } from "next";

const isExport = process.env.NEXT_OUTPUT_EXPORT === "true";

const nextConfig: NextConfig = {
  output: isExport ? "export" : undefined,
  trailingSlash: isExport ? true : undefined,
  images: {
    unoptimized: true,
  },
  async rewrites() {
    if (isExport) return [];
    const rawBackend = process.env.NABD_BACKEND_URL || "http://127.0.0.1:8040";
    const normalized = rawBackend.startsWith("http://") || rawBackend.startsWith("https://")
      ? rawBackend.replace(/\/+$/, "")
      : `https://${rawBackend.replace(/\/+$/, "")}`;

    return [
      {
        source: "/api/:path*",
        destination: `${normalized}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;

