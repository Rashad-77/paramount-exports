import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { publicEnv } from "@/lib/env";
import { getBusinessSettings, isPlaceholderBusiness } from "@/lib/settings";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f3ed",
};

export async function generateMetadata(): Promise<Metadata> {
  const business = await getBusinessSettings();
  const placeholder = isPlaceholderBusiness(business);
  return {
    metadataBase: new URL(publicEnv().NEXT_PUBLIC_SITE_URL),
    title: { default: placeholder ? "Wood furniture — showroom & made-to-order" : business.name, template: `%s · ${business.name}` },
    description:
      business.tagline ?? "Ready-made and made-to-order wood furniture from our workshop, with a showroom you can visit.",
    // A site still showing placeholder details must not be indexed.
    robots: placeholder ? { index: false, follow: false } : { index: true, follow: true },
  };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Marks that scripting is available, so scroll-reveal content may start hidden (see Reveal). */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body className="ambient-page">
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
