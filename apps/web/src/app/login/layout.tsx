import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in to Pluto with Google to track expenses, set budgets, and review spending reports.",
  // A sign-in page carries no search value and can confuse crawlers.
  robots: { index: false, follow: true },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
