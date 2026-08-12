import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray package-lock.json in the parent directory made Turbopack look
  // outside the repo for the workspace root. Pin it to this project.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
