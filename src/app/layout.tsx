import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Become a Live Play Host | LivePlayHosts",
  description:
    "Join the Live Play Hosts community. Share your passion, engage with audiences, and earn money as a professional live host.",
  keywords: "live hosting, live streaming, host jobs, content creator, live play",
  openGraph: {
    title: "Become a Live Play Host | LivePlayHosts",
    description:
      "Join the Live Play Hosts community. Share your passion, engage with audiences, and earn money as a professional live host.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
