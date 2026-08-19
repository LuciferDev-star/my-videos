import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    tsconfigPath: "tsconfig.app.json",
  },
  output: "standalone",
  // These spawn/drive a headless Chrome renderer and aren't meant to be
  // bundled - forcing Turbopack to trace through them crashes the build.
  // Load them via Node's own require at runtime instead.
  serverExternalPackages: ["@remotion/bundler", "@remotion/renderer"],
};

export default nextConfig;
