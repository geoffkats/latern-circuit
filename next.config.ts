import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Node built-ins out of the worker graph if a dependency probes for them.
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.fallback = {
      ...(config.resolve.fallback ?? {}),
      fs: false,
      path: false,
      crypto: false,
    };
    return config;
  },
};

export default nextConfig;
