import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  pageExtensions: ["page.tsx", "page.ts", "page.jsx", "page.js"],
  async rewrites() {
    return [{ source: "/:path*", destination: "/" }];
  },
};

export default nextConfig;
