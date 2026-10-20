import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Share and icon images read these at render time; make sure deployments include them.
  outputFileTracingIncludes: {
    "/opengraph-image": ["./assets/fonts/**"],
    "/twitter-image": ["./assets/fonts/**"],
    "/apple-icon": ["./assets/fonts/**"],
  },
  partialPrefetching: true,
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
