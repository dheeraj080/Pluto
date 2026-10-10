import type { Metadata } from "next";
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

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Pluto — exchange rates & secure cloud backups for Android",
    template: "%s · Pluto",
  },
  description:
    "Pluto for Android: daily exchange rates from the European Central Bank and automatic, encrypted cloud backups of your data — secured with Google Sign-In.",
  openGraph: {
    title: "Pluto",
    description:
      "Daily exchange rates and automatic encrypted cloud backups for Android.",
    url: siteUrl,
    siteName: "Pluto",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
