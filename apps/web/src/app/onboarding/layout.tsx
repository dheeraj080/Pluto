import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Set up your currency",
  description: "Choose the currency Pluto uses to summarise your spending.",
  robots: { index: false, follow: false },
};

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return children;
}