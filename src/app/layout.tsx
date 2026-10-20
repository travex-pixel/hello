import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/shell/AppShell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HELLO — Meet someone interesting. In one tap.",
  description:
    "Tap one button and start a spontaneous conversation. The demo pairs you with clearly labelled AI characters, no account required.",
  applicationName: "HELLO",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "HELLO" },
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
      </body>
    </html>
  );
}
