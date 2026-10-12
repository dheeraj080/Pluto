import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What data Pluto collects, why, how long it is kept, and how to exercise your GDPR rights.",
};

/*
 * DRAFT — reviewed by counsel before production launch.
 * Content is derived from the actual data flows implemented in pluto-server:
 *  - Google Sign-In (email, name, avatarUrl, googleId)          [modules/auth]
 *  - Cloud backups in S3-compatible storage (encrypted blobs)    [modules/backups]
 *  - Refresh sessions (IP address, user agent, timestamps)       [prisma/schema.prisma]
 *  - ECB reference rates via Frankfurter (no personal data)      [modules/rates]
 */

const EFFECTIVE_DATE = "October 10, 2026";

export default function PrivacyPage() {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted">Effective date: {EFFECTIVE_DATE}</p>

      <div className="mt-8 space-y-8 text-[15px] leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold">1. Overview</h2>
          <p className="mt-2">
            Pluto (&quot;the service&quot;, &quot;we&quot;, &quot;us&quot;) is an international expense
            tracker available on the web, alongside the Pluto app for Android. It helps you record
            spending in any currency and review it in a currency you choose, using reference
            exchange rates. This policy explains what personal information we process, why we
            process it, how long we keep it, and how to exercise your rights. It applies to our
            backend services and this website.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">2. Information we collect</h2>
          <h3 className="mt-3 font-medium">Google account information</h3>
          <p className="mt-1">
            When you sign in with Google, we receive and store your Google account&apos;s{" "}
            <strong>email address</strong>, <strong>display name</strong>,{" "}
            <strong>profile picture</strong>, and a <strong>unique Google account identifier</strong>.
            We authenticate you by verifying a Google-issued ID token; we never see, request, or
            store your Google password.
          </p>

          <h3 className="mt-3 font-medium">Cloud backup files and metadata</h3>
          <p className="mt-1">
            If you use cloud backup, we store your backup file — an <strong>encrypted snapshot of
            your app database</strong>, encrypted on your device before it leaves it — together with
            technical metadata: file size, SHA-256 checksum, app version, database schema version,
            backup sequence number, and creation/completion timestamps.
          </p>

          <h3 className="mt-3 font-medium">Device and session information</h3>
          <p className="mt-1">
            When a session is created or refreshed we record your <strong>IP address</strong>,{" "}
            <strong>browser or device user-agent string</strong>, and session timestamps
            (creation, expiry, revocation). We use this to keep sessions secure — including
            detecting stolen-token replay — and to let you review and revoke active sessions.
          </p>

          <h3 className="mt-3 font-medium">Exchange rate data</h3>
          <p className="mt-1">
            Rate lookups contain <strong>no personal data</strong>. We fetch reference rates from
            the European Central Bank through a third-party service; nothing that identifies you is
            sent when we fetch them.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">3. How we use your information</h2>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>To authenticate you and operate your account (sign-in, sessions, profile).</li>
            <li>To store, restore, and delete your cloud backups.</li>
            <li>
              To secure the service: rate limiting, replay detection, session revocation, and
              abuse prevention.
            </li>
            <li>To diagnose outages and keep the service reliable.</li>
            <li>To comply with legal obligations and respond to lawful requests.</li>
          </ul>
          <p className="mt-2">
            We do <strong>not</strong> sell your data, do not use advertising trackers, and do not
            build marketing profiles.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">4. Legal bases for processing (GDPR)</h2>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>
              <strong>Contract</strong> — providing sign-in and backup storage you requested.
            </li>
            <li>
              <strong>Legitimate interests</strong> — securing the service, preventing fraud and
              token replay.
            </li>
            <li>
              <strong>Consent</strong> — for optional features; you can withdraw it at any time by
              disabling backups or deleting your account.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold">5. Sharing of information</h2>
          <p className="mt-2">We share data only with processors that run the service:</p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>
              <strong>Google</strong> — authentication (subject to Google&apos;s own privacy
              policy).
            </li>
            <li>
              <strong>Cloud storage provider</strong> — stores your encrypted backup files.
            </li>
            <li>
              <strong>Hosting provider</strong> — runs the backend infrastructure.
            </li>
          </ul>
          <p className="mt-2">
            These processors act on our instructions and are bound by data-processing agreements.
            We do not share data with any other third parties except where required by law.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">6. Retention</h2>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>
              <strong>Refresh sessions</strong> — kept up to 30 days, and deleted immediately on
              logout or revocation.
            </li>
            <li>
              <strong>Backups</strong> — kept while your account exists. Only your most recent
              backups are retained; older ones are automatically pruned.
            </li>
            <li>
              <strong>Account data</strong> — kept until you delete your account. Deletion is
              immediate and permanent (see below).
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold">7. Security</h2>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>All traffic is encrypted in transit (TLS/HSTS).</li>
            <li>
              Short-lived access tokens with one-time rotating refresh tokens; presenting a reused
              token revokes all of that account&apos;s sessions.
            </li>
            <li>Backups are encrypted on your device before upload.</li>
            <li>Storage objects are reachable only through short-lived, per-file signed URLs.</li>
            <li>Database and storage credentials are never exposed to the client.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold">8. Your rights</h2>
          <p className="mt-2">
            Depending on your location, you may have the right to access, correct, export, erase,
            restrict, or object to the processing of your personal data, and to data portability.
            You can:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>
              <strong>Export</strong> — download your backups from the app before deleting
              anything.
            </li>
            <li>
              <strong>Erase</strong> — permanently delete your account, backups, and sessions at{" "}
              <a href="/delete-account" className="text-primary underline underline-offset-2">
                Delete account
              </a>
              .
            </li>
            <li>
              <strong>Access or correction</strong> — contact us (section 11).
            </li>
          </ul>
          <p className="mt-2">
            You may also lodge a complaint with your local data-protection supervisory authority.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">9. International transfers</h2>
          <p className="mt-2">
            Our servers and processors may operate in countries other than your own. Where personal
            data is transferred internationally, we rely on appropriate safeguards such as
            Standard Contractual Clauses or adequacy decisions.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">10. Children</h2>
          <p className="mt-2">
            The app is not directed at children under 13 (or the minimum age in your country), and
            we do not knowingly collect their data. If you believe a child has provided us with
            personal data, contact us and we will delete it.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">11. Changes and contact</h2>
          <p className="mt-2">
            We may update this policy from time to time. Material changes will be announced in the
            app, and the new effective date will be posted on this page.
          </p>
          <p className="mt-2">
            Questions about this policy or your data:{" "}
            <a href="mailto:support@pluto.app" className="text-primary underline underline-offset-2">
              support@pluto.app
            </a>
            .
          </p>
        </section>
      </div>
    </article>
  );
}
