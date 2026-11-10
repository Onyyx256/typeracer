import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    serverActions: {
      // 2 MB photos plus room for the multipart overhead. The action itself
      // refuses anything over 2 MB.
      bodySizeLimit: "2.1mb",
    },
  },
  logging: {
    // The dev log prints Server Function arguments, which here include passwords.
    serverFunctions: false,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
