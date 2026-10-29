import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {
    root: __dirname,
  },
  outputFileTracingIncludes: {
    '/api/**/*': ['./src/lib/contracts/fonts/DancingScript-Variable.ttf'],
  },
};

export default nextConfig;
