import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const socialImage = `${protocol}://${host}/og-vipkorner.png`;
  const title = "VipKorner — Your people, your moments";
  const description = "An installable social app for public profiles, posts, 24-hour stories, and private messages.";

  return {
    title,
    description,
    manifest: "/manifest.webmanifest",
    icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
    metadataBase: new URL(`${protocol}://${host}`),
    alternates: { canonical: "/" },
    appleWebApp: { capable: true, statusBarStyle: "default", title: "VipKorner" },
    openGraph: { title, description, type: "website", siteName: "VipKorner", images: [{ url: socialImage, width: 1200, height: 630, alt: "VipKorner — Your people, your moments, your corner" }] },
    twitter: { card: "summary_large_image", title, description, images: [socialImage] },
  };
}

export const viewport: Viewport = { themeColor: "#fffaf5", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={geist.variable}>{children}</body></html>;
}
