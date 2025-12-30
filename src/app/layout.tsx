import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "NextJuke - The Social Party Jukebox",
  description:
    "Turn any screen into a collaborative party jukebox. Let guests queue songs from their phones instantly via QR Code. No apps required.",
  // --- เพิ่มส่วนนี้สำหรับ iOS Web App Fullscreen ---
  appleWebApp: {
    capable: true,
    title: "NextJuke",
    statusBarStyle: "black-translucent", // ให้ status bar โปร่งใสเห็นพื้นหลัง
  },
  // ---------------------------------------------
  keywords: [
    "Jukebox",
    "Party Playlist",
    "Collaborative Music",
    "YouTube Player",
    "Next.js",
    "NextJuke",
    "Nextamp",
  ],
  authors: [{ name: "Your Name" }],
  applicationName: "NextJuke",
  openGraph: {
    title: "NextJuke - Join the Party!",
    description:
      "Scan QR, Queue Songs, Party Hard. The best way to manage music with friends.",
    url: "https://nextjuke.vercel.app",
    siteName: "NextJuke",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "NextJuke Party Interface",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "NextJuke - The Social Party Jukebox",
    description: "Collaborative music queuing for your next party.",
    images: ["/og-image.jpg"],
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
