import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep native / wasm-backed packages out of the bundle so they load from
  // node_modules at runtime (PGlite ships a wasm build + a filesystem loader;
  // postgres is a native-ish driver).
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
  eslint: {
    // Lint is run explicitly in CI via `npm run lint`; don't fail `next build`
    // on style-only warnings.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
