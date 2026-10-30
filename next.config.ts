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
  experimental: {
    // The browser keeps a page it has just shown for a short while, so going back to it, or clicking the same link again, is instant instead of
    // asking the server again. Saving anything on the dashboard clears this, so an edit always shows. (Pages that are fully loaded ahead of a
    // click, such as the dashboard menu on hover, are kept for the second figure.)
    staleTimes: { dynamic: 30, static: 60 },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    // Few sizes, so most phones and computers share the same stored copies of a photograph (the list is mirrored in src/lib/image-sizes.ts).
    deviceSizes: [640, 960, 1280, 1920],
    imageSizes: [96, 256, 384],
    // A resized photograph is kept for 31 days (the default is 4 hours), so a visitor rarely waits for one to be made. Every upload gets a new
    // address, so a replaced photograph is never served from an old copy.
    minimumCacheTTL: 2678400,
    // Supabase Storage (our uploads) and Google profile pictures (customers who signed in with Google).
    remotePatterns: [...(supabaseHost ? [{ protocol: "https" as const, hostname: supabaseHost, pathname: "/storage/v1/object/public/public-media/**" }] : []), { protocol: "https" as const, hostname: "*.googleusercontent.com", pathname: "/**" }],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The videos and stills in /public/media: kept by browsers and the network for a day, and shown while a newer copy is fetched for a week.
      { source: "/media/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }] },
    ];
  },
  // The website's own address is the one search engines should list. The old Vercel addresses forward to it (permanently), so there is only one
  // copy of every page. The daily housekeeping job is left alone: Vercel calls it on the old address and does not follow a redirect.
  async redirects() {
    const site = process.env.NEXT_PUBLIC_SITE_URL;
    if (!site || /\.vercel\.app/.test(site)) return [];
    return ["paramount-exports.vercel.app", "paramount-exports-r-builds.vercel.app"].map((host) => ({
      source: "/:path((?!api/cron).*)",
      has: [{ type: "host" as const, value: host }],
      destination: `${site.replace(/\/$/, "")}/:path`,
      permanent: true,
    }));
  },
};

export default nextConfig;
