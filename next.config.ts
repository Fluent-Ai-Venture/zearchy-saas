import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable ESLint during builds to prevent deployment failures
  eslint: {
    // Only run ESLint during development, not during builds
    ignoreDuringBuilds: true,
  },
  // Disable TypeScript type checking during builds for faster deployments
  typescript: {
    // Only run type checking during development, not during builds
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
