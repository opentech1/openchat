import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Webpack handles Workers better than Turbopack currently
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }
    return config;
  },
};

export default nextConfig;
