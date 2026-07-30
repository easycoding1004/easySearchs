import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bundles a minimal server.js + only-needed node_modules into
  // .next/standalone — the Dockerfile copies just that instead of the full
  // node_modules tree.
  output: "standalone",
  // garu-ko loads its .wasm binary and .gmdl model file at runtime (not a
  // static `require`), so Next's file-tracing misses both and the
  // standalone build ships without them — breaks tokenize.ts (used by
  // /api/search, /api/blog-score, and the 블로그지수 result page) in
  // production with an ENOENT. Force the whole package into the trace.
  // Same issue for new_blog/*.md — blogRules.ts reads them with fs at
  // runtime (src/lib/write/blogRules.ts), not a static import.
  outputFileTracingIncludes: {
    "/**": ["./node_modules/garu-ko/**", "./new_blog/**"],
  },
};

export default nextConfig;
