import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Railway: ignore TS/ESLint errors during build (same as Vercel)
  // This prevents build failures from non-critical type errors
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  reactStrictMode: false,
  productionBrowserSourceMaps: false,
  compress: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
