import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // drei <Html> labels unmount a nested React root during render under StrictMode double-invocation in dev
  reactStrictMode: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    root: __dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
