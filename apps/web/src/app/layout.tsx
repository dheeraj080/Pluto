import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "Pluto",
  title: {
    default: "Pluto — Spend in any currency. Understand it in yours.",
    template: "%s · Pluto",
  },
  description:
    "Record every purchase in the currency you actually paid, then see your totals, budgets and trends in the one you think in. Daily ECB reference rates, Google sign-in, no ads or trackers. Web and mobile.",
  keywords: [
    "multi-currency expense tracker",
    "currency conversion",
    "ECB reference rates",
    "travel budget app",
    "expat expense tracking",
  ],
  openGraph: {
    title: "Pluto — Spend in any currency. Understand it in yours.",
    description:
      "Multi-currency expense tracking with daily ECB rates. Record as you pay, review in your own currency.",
    url: siteUrl,
    siteName: "Pluto",
    type: "website",
    locale: "en",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pluto — Spend in any currency. Understand it in yours.",
    description:
      "Multi-currency expense tracking with daily ECB rates. Web and mobile.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0B0C0E",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
