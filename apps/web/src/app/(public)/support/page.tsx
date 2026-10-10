import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Support",
  description: "Frequently asked questions about Pluto — sign-in, backups, exchange rates, and privacy.",
};

const FAQ = [
  {
    q: "What is Pluto?",
    a: "Pluto is an Android app that shows daily exchange rates and keeps automatic, encrypted backups of your data in the cloud. You sign in with your Google account — there is no separate password to create or remember.",
  },
  {
    q: "How do I sign in?",
    a: "Tap Sign in with Google in the app and choose your account. We receive only your email address, name, profile picture, and a Google account identifier — never your Google password.",
  },
  {
    q: "How do cloud backups work?",
    a: "Your app database is checkpointed and encrypted on your device, a SHA-256 checksum is computed, and the encrypted file is uploaded directly to object storage through a short-lived signed URL. On completion the server verifies the object and its size. Only your most recent backups are retained — older ones are pruned automatically.",
  },
  {
    q: "How do I restore my data?",
    a: "Sign in on the new device with the same Google account and download a backup from the in-app restore screen, or from the Delete account page's export step. Download links are single-purpose and expire after a few minutes for safety.",
  },
  {
    q: "How often are exchange rates updated?",
    a: "Once a day, automatically, shortly after the European Central Bank publishes its reference rates. The app caches rates locally, so previously loaded rates stay available offline.",
  },
  {
    q: "Why do your rates differ from my bank's?",
    a: "Banks and card providers set their own retail rates and margins. Pluto shows the official ECB reference rates — the same numbers used by financial institutions as a reference point.",
  },
  {
    q: "Is my data safe?",
    a: "Backups are encrypted on your device before upload, all traffic uses TLS, access tokens are short-lived, and storage objects are reachable only through per-file signed URLs. See the Privacy Policy for the full picture.",
  },
  {
    q: "How do I delete my account?",
    a: "Open the Delete account page, sign in with Google, optionally download a copy of your backups, and confirm. Your profile, backups, and sessions are erased immediately and permanently.",
  },
] as const;

export default function SupportPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Support</h1>
      <p className="mt-2 text-muted">
        Answers to the most common questions. Still stuck? Contact us at{" "}
        <a href="mailto:support@pluto.app" className="text-accent underline underline-offset-2">
          support@pluto.app
        </a>
        .
      </p>

      <div className="mt-8 divide-y divide-border rounded-xl border border-border">
        {FAQ.map((item) => (
          <details key={item.q} className="group px-5 py-4">
            <summary className="cursor-pointer list-none font-medium marker:hidden">
              <span className="flex items-center justify-between gap-4">
                {item.q}
                <span
                  aria-hidden="true"
                  className="text-muted transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted">{item.a}</p>
          </details>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-3 text-sm">
        <Link
          href="/privacy"
          className="rounded-lg border border-border px-4 py-2 transition-colors hover:bg-background"
        >
          Privacy Policy
        </Link>
        <Link
          href="/terms"
          className="rounded-lg border border-border px-4 py-2 transition-colors hover:bg-background"
        >
          Terms of Service
        </Link>
        <Link
          href="/status"
          className="rounded-lg border border-border px-4 py-2 transition-colors hover:bg-background"
        >
          Service status
        </Link>
      </div>
    </div>
  );
}
