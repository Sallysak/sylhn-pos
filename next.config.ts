import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // NOTE: We previously had `typescript.ignoreBuildErrors: true` and
  // `eslint.ignoreDuringBuilds: true` here. Those have been REMOVED so that
  // TypeScript and ESLint errors fail the production build. This is a
  // deliberate quality gate — if the build breaks, fix the type/lint error
  // instead of suppressing it.
  reactStrictMode: false,  // disabled because POS uses many refs/effects that don't tolerate double-invoke
  // Security: don't expose source maps in production
  productionBrowserSourceMaps: false,
  // Compress responses (Caddy also does this, but enable here for direct exposure)
  compress: true,
  // Powered-By header removed for security
  poweredByHeader: false,
  // Allow specific image domains for product images (empty = same-origin only)
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
