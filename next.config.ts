import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // ===== Headers — ensure the preview iframe can embed the app =====
  // These are applied IN ADDITION to the proxy.ts middleware headers.
  // The key fix: NO X-Frame-Options header (it blocks cross-origin iframes).
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: "default-src * 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; frame-ancestors *; form-action 'self'; base-uri 'self'; object-src 'none'" },
          { key: "Cross-Origin-Opener-Policy", value: "cross-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, PATCH, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization, X-CSRF-Token, X-Requested-With" },
          { key: "Access-Control-Allow-Credentials", value: "true" },
        ],
      },
    ];
  },
};

export default nextConfig;
