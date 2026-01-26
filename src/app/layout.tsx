import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "Become a LivePlay Host | LivePlayHosts",
  description:
    "Join the LivePlay Hosts community. Share your passion, engage with audiences, and earn money as a professional live host.",
  keywords: "live hosting, live streaming, host jobs, content creator, liveplay",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "LivePlay Hosts",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "Become a LivePlay Host | LivePlayHosts",
    description:
      "Join the LivePlay Hosts community. Share your passion, engage with audiences, and earn money as a professional live host.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#292b7f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          {/* Apple Touch Icons */}
          <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
          <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-152x152.png" />
          <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon-180x180.png" />
          <link rel="apple-touch-icon" sizes="167x167" href="/icons/apple-touch-icon-167x167.png" />
        </head>
        <body className="antialiased">{children}</body>
      </html>
    </ClerkProvider>
  );
}
