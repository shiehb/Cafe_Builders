import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  async rewrites() {
    return [
      { source: "/admin", destination: "/" },
      { source: "/admin/:path*", destination: "/" },
      { source: "/pos", destination: "/" },
      { source: "/kds", destination: "/" },
      { source: "/cart", destination: "/" },
      { source: "/cart/:path*", destination: "/" },
      { source: "/checkout", destination: "/" },
      { source: "/item/:path*", destination: "/" },
      { source: "/order/:path*", destination: "/" },
    ];
  },
};

export default nextConfig;
