import type { Metadata } from "next";
import "./landing.css";
import { FoldedMarginPage } from "@/components/landing/folded-margin";

export const metadata: Metadata = {
  title: "Spend in any currency. Understand it in yours.",
  alternates: { canonical: "/" },
  description:
    "Track expenses in foreign currencies and see what they add up to in your home currency. Made for students, expats, and travellers.",
  openGraph: {
    title: "Spend in any currency. Understand it in yours.",
    description:
      "Track expenses in foreign currencies and see what they add up to in your home currency. Made for students, expats, and travellers.",
    url: "/",
    type: "website",
  },
};

export default function Home() {
  return <FoldedMarginPage />;
}
