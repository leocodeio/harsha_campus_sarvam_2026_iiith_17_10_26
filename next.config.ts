import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // We frame other sites; nobody frames us.
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        { key: "Referrer-Policy", value: "no-referrer" },
      ],
    },
  ],
}

export default nextConfig
