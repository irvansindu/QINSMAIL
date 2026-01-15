import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.qrserver.com',
      },
    ],
  },
  // Avoid bundling imapflow's internal tests by treating it as an external server package
  serverExternalPackages: ["imapflow"],
  turbopack: {
    // Explicitly set the project root to avoid root inference warnings
    root: __dirname,
  },
};

export default nextConfig;
