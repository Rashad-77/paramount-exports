import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // The parts of a Content-Security-Policy that cannot break Next.js's own inline scripts. A script-src policy needs
  // per-request nonces and is listed under "future work" in docs/SECURITY_REVIEW.md.
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
];

// Catalogue photos are served from the Supabase public bucket and optimised by next/image.
const supabaseHost = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : null;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  // A separate build folder for the browser tests (NEXT_DIST_DIR=.next-e2e) lets them build while `pnpm dev` keeps running.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
    // Few sizes, so most phones and computers share the same stored copies of a photograph (the list is mirrored in src/lib/image-sizes.ts).
    deviceSizes: [640, 960, 1280, 1920],
    imageSizes: [96, 256, 384],
    // A resized photograph is kept for 31 days (the default is 4 hours), so a visitor rarely waits for one to be made. Every upload gets a new
    // address, so a replaced photograph is never served from an old copy.
    minimumCacheTTL: 2678400,
    remotePatterns: supabaseHost ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/public-media/**" }] : [],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
