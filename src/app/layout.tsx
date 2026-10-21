import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Analytics } from "@vercel/analytics/next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
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

/** Display serif for headlines and the wordmark. Variable, so one file covers every weight. */
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "opsz"],
  display: "swap",
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
  title: { default: SHARE_TITLE, template: "%s · hello" },
  description: SHARE_DESCRIPTION,
  applicationName: "hello",
  appleWebApp: { capable: true, statusBarStyle: "black", title: "hello" },
  openGraph: {
    type: "website",
    siteName: "hello",
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
  themeColor: "#080d19",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}>
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
