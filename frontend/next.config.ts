import type { NextConfig } from "next";
import path from "node:path";
import { loadEnvConfig } from "@next/env";

// Load monorepo root `.env` / `.env.local` (same file backend uses)
const monorepoRoot = path.join(__dirname, "..");
loadEnvConfig(monorepoRoot);

const nextConfig: NextConfig = {
  // pnpm workspace: pin Turbopack root so it resolves `next` correctly.
  turbopack: {
    root: monorepoRoot,
  },
  outputFileTracingRoot: monorepoRoot,
  async redirects() {
    return [
      {
        source: "/projects",
        destination: "/startups",
        permanent: true,
      },
      {
        source: "/projects/:path*",
        destination: "/startups/:path*",
        permanent: true,
      },
      {
        source: "/account/models",
        destination: "/account",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
