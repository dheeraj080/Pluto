import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that apply when you use the Pluto app and this website.",
};

/*
 * DRAFT — reviewed by counsel before production launch.
 * Placeholders flagged for the launch checklist: governing law, contact email.
 */

const EFFECTIVE_DATE = "October 10, 2026";

export default function TermsPage() {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted">Effective date: {EFFECTIVE_DATE}</p>

      <div className="mt-8 space-y-8 text-[15px] leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold">1. Acceptance of terms</h2>
          <p className="mt-2">
            These Terms govern your use of the Pluto expense tracker on the web, the Pluto app
            for Android, and related services (the &quot;Service&quot;). By creating an account or
            using the Service you agree to these Terms and to our{" "}
            <a href="/privacy" className="text-primary underline underline-offset-2">
              Privacy Policy
            </a>
            . If you do not agree, do not use the Service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">2. The Service</h2>
          <p className="mt-2">
            Pluto lets you record expenses in the currency you paid and review them in a
            reporting currency of your choice, using exchange-rate reference information published
            by the European Central Bank. Rates are provided for informational purposes only —
            they are <strong>not financial advice</strong>, and we do not guarantee their accuracy,
            completeness, or timeliness.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">3. Accounts</h2>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>
              You sign in with a Google account, and you must be at least 13 years old (or the
              minimum digital-consent age in your country) to use the Service.
            </li>
            <li>
              You are responsible for activity performed through your account and must keep your
              devices secure.
            </li>
            <li>
              You may delete your account at any time via{" "}
              <a href="/delete-account" className="text-primary underline underline-offset-2">
                Delete account
              </a>
              ; deletion is permanent and irreversible.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold">4. Acceptable use</h2>
          <p className="mt-2">You agree not to:</p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>use the Service for unlawful purposes or to transmit malicious code;</li>
            <li>attempt to bypass authentication, rate limits, or access controls;</li>
            <li>reverse-engineer, scrape, or overload the Service except as permitted by law;</li>
            <li>impersonate others or misrepresent your affiliation.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold">5. Your data and backups</h2>
          <p className="mt-2">
            You retain all rights to the data you store in the Service. You grant us only the
            limited license needed to store, process, and transmit that data to provide backups.
            Backups are provided as a convenience: <strong>you remain responsible for keeping
            your own copies</strong> of important data. We may prune older backups subject to the
            retention limits described in the Privacy Policy.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">6. Intellectual property</h2>
          <p className="mt-2">
            The Service, including its software, design, and branding, is owned by us and
            protected by intellectual-property laws. These Terms do not grant you any rights to
            our materials except the limited right to use the Service as intended.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">7. Third-party services</h2>
          <p className="mt-2">
            The Service relies on third parties (Google for sign-in, a cloud-storage provider for
            backups, and the European Central Bank for rate data). Their availability and terms
            apply to the features they power, and we are not responsible for their acts or
            omissions.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">8. Availability and changes</h2>
          <p className="mt-2">
            We may modify, suspend, or discontinue any part of the Service at any time. We work to
            keep the Service reliable but it is provided <strong>&quot;as is&quot;</strong>{" "}
            without warranties of any kind, express or implied, including merchantability, fitness
            for a particular purpose, and uninterrupted availability.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">9. Limitation of liability</h2>
          <p className="mt-2">
            To the maximum extent permitted by law, we are not liable for any indirect,
            incidental, special, consequential, or punitive damages, or for loss of data, profits,
            or goodwill, arising from your use of the Service. Our total liability for any claim
            relating to the Service is limited to the amount you paid us in the twelve months
            before the claim (or, if you paid nothing, to the equivalent of one month of the
            Service&apos;s then-current price, or the minimum allowed by law).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">10. Termination</h2>
          <p className="mt-2">
            You may stop using the Service at any time. We may suspend or terminate your access if
            you breach these Terms, if required by law, or to protect the Service and its users.
            Sections that by their nature should survive termination (including disclaimers and
            limitation of liability) will survive.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">11. Governing law</h2>
          <p className="mt-2">
            {/* TODO(launch checklist): replace with the actual governing law / venue. */}
            These Terms are governed by the laws applicable in our principal place of business,
            without regard to conflict-of-law rules, and any disputes will be resolved in its
            competent courts. Mandatory consumer protections in your country of residence remain
            unaffected.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">12. Changes and contact</h2>
          <p className="mt-2">
            We may update these Terms; material changes will be announced in the app with a new
            effective date. Continued use after changes take effect constitutes acceptance.
          </p>
          <p className="mt-2">
            Questions:{" "}
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
