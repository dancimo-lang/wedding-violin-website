import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  distDir: '.next',
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
