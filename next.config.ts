import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {
    // Force turbopack to treat this project folder as the root so it picks up the correct Tailwind config
    root: __dirname,
  },
};

export default nextConfig;
