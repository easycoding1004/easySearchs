import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bundles a minimal server.js + only-needed node_modules into
  // .next/standalone — the Dockerfile copies just that instead of the full
  // node_modules tree.
  output: "standalone",
};

export default nextConfig;
