import Link from "next/link";
import { RatesPreview } from "@/components/rates-preview";

/*
 * TODO(launch checklist): replace the Play Store href with the real listing URL
 * (the package name below is a placeholder based on the server docs example).
 */
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.pluto.app";

const FEATURES = [
  {
    title: "Daily ECB exchange rates",
    body: "Reference rates from the European Central Bank, synchronized automatically every morning and cached with ETag — so you get accurate numbers without re-downloading anything.",
  },
  {
    title: "Encrypted cloud backups",
    body: "Your database is encrypted on your device, then snapshotted to the cloud with SHA-256 verification. Only your most recent backups are kept; older ones are pruned automatically.",
  },
  {
    title: "Sign-in without passwords",
    body: "Just Google Sign-In. Short-lived access tokens, one-time rotating refresh tokens, and replay protection keep your account locked down.",
  },
] as const;

const STEPS = [
  {
    n: "01",
    title: "Tap backup",
    body: "The app checkpoints and encrypts its database, computes a SHA-256 checksum, and asks the server for an upload slot.",
  },
  {
    n: "02",
    title: "Direct-to-storage upload",
    body: "Bytes stream straight to encrypted object storage through a short-lived signed URL — they never pass through our application servers.",
  },
  {
    n: "03",
    title: "Restorable anytime",
    body: "Each backup is verified on completion. Download any snapshot with a fresh, single-use link whenever you need it.",
  },
] as const;

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="mx-auto w-full max-w-5xl px-4 pb-16 pt-20 text-center sm:px-6 sm:pt-24">
        <p className="text-sm font-medium uppercase tracking-widest text-accent">
          For Android
        </p>
        <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
          Exchange rates you can trust.
          <br />
          Backups you never think about.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted">
          Pluto brings you daily European Central Bank reference rates and automatic,
          encrypted cloud backups of your data — secured with Google Sign-In.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <a
            href={PLAY_STORE_URL}
            className="rounded-lg bg-accent px-5 py-2.5 font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            Get it on Google Play
          </a>
          <a
            href="#how"
            className="rounded-lg border border-border px-5 py-2.5 font-medium transition-colors hover:bg-background"
          >
            How backups work
          </a>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border bg-background/50">
        <div className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight">Everything, nothing extra</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="rounded-xl border border-border p-5">
                <h3 className="font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Live rates */}
      <section className="border-t border-border">
        <div className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-2xl font-bold tracking-tight">Today&apos;s rates</h2>
            <p className="text-sm text-muted">Updated once a day, straight from the ECB.</p>
          </div>
          <div className="mt-6">
            <RatesPreview />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-t border-border bg-background/50">
        <div className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight">Backups in three steps</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.n}>
                <p className="font-mono text-sm font-semibold text-accent">{step.n}</p>
                <h3 className="mt-1 font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="border-t border-border">
        <div className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6">
          <div className="rounded-2xl border border-border p-8 sm:p-10">
            <h2 className="text-2xl font-bold tracking-tight">Privacy by design</h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
              No ads, no trackers, no selling data. Backups are encrypted before they leave
              your device, sessions rotate one time at a time, and you can erase everything
              — profile, backups, sessions — in one tap.
            </p>
            <div className="mt-5 flex flex-wrap gap-3 text-sm">
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
                href="/delete-account"
                className="rounded-lg border border-border px-4 py-2 transition-colors hover:bg-background"
              >
                Delete your account
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Download CTA */}
      <section id="download" className="border-t border-border bg-background/50">
        <div className="mx-auto w-full max-w-5xl px-4 py-16 text-center sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight">Get Pluto</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted">
            Free, with Google Sign-In and automatic backups built in.
          </p>
          <a
            href={PLAY_STORE_URL}
            className="mt-6 inline-block rounded-lg bg-accent px-6 py-3 font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            Get it on Google Play
          </a>
        </div>
      </section>
    </>
  );
}
