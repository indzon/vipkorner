import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://vipkorner.vipkorner.workers.dev";
const title = "VipKorner — Your people, your moments";
const description = "An installable social app for public profiles, posts, 24-hour stories, and private messages.";

export const metadata: Metadata = {
  title,
  description,
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
  metadataBase: new URL(siteUrl),
  alternates: { canonical: "/" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "VipKorner" },
  openGraph: { title, description, type: "website", siteName: "VipKorner", images: [{ url: "/og-vipkorner.png", width: 1200, height: 630, alt: "VipKorner — Your people, your moments, your corner" }] },
  twitter: { card: "summary_large_image", title, description, images: ["/og-vipkorner.png"] },
};

export const viewport: Viewport = { themeColor: "#fffaf5", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={geist.variable}>{children}</body></html>;
}
