import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Analytics } from "@vercel/analytics/next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/shell/AppShell";
import { SHARE_DESCRIPTION, SHARE_TITLE } from "@/lib/og/brand";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Share previews need absolute URLs. On Vercel, use the stable production
 * domain so every shared link (including previews) shows the same card.
 * NEXT_PUBLIC_SITE_URL overrides it, for example after adding a custom domain.
 */
function siteUrl(): URL {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return new URL(explicit);
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercel) return new URL(`https://${vercel}`);
  return new URL("http://localhost:3000");
}

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: { default: SHARE_TITLE, template: "%s · HELLO" },
  description: SHARE_DESCRIPTION,
  applicationName: "HELLO",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "HELLO" },
  openGraph: {
    type: "website",
    siteName: "HELLO",
    title: SHARE_TITLE,
    description: SHARE_DESCRIPTION,
    url: "/",
    locale: "en",
  },
  twitter: {
    card: "summary_large_image",
    title: SHARE_TITLE,
    description: SHARE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0c14",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <div className="ambient" aria-hidden="true" />
        <AppShell>{children}</AppShell>
        {/*
          Vercel Web Analytics: anonymous visitors and page views, no cookies.
          It reads the URL, so it sits in Suspense to keep pages prerenderable.
          Routes are grouped, so every chat counts under /chat/[id].
        */}
        <Suspense fallback={null}>
          <Analytics />
        </Suspense>
      </body>
    </html>
  );
}
