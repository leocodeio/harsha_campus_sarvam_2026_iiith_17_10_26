import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Only we may frame our pages (the /api/view proxy is framed by /app).
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
        { key: "Referrer-Policy", value: "no-referrer" },
      ],
    },
  ],
}

export default nextConfig
