import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Minimal, self-contained production build for the Docker image — see
  // Dockerfile. Copies only the files `next build` traces as actually used.
  output: "standalone",
  // Cache Components (PPR + `use cache`) is off: almost every route in this
  // app is per-workspace authenticated data, so there's no static shell to
  // gain from it, and it would force Suspense boundaries + `use cache: private`
  // around every session/workspace read. Standard dynamic rendering is simpler here.
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
