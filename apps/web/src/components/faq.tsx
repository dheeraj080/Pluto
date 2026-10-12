/**
 * Landing-page FAQ: five questions in a compact two-column accordion.
 * Uses native `details`/`summary` so it works without JavaScript and stays
 * keyboard-accessible.
 */

const FAQ = [
  {
    q: "Which currencies are supported?",
    a: "Pluto uses the European Central Bank reference set — around thirty currencies, including EUR, USD, GBP, CHF, JPY, SGD and INR. Record a purchase in any of them and read your totals in the one you think in.",
  },
  {
    q: "Where do the exchange rates come from?",
    a: "From the European Central Bank's daily reference rates, refreshed once a day. Every converted figure is dated with the rate it used, so you always know which day's numbers you are looking at.",
  },
  {
    q: "Is Pluto free?",
    a: "Yes. Recording expenses, conversion, budgets and reports are free. There are no ads and no paid tiers that unlock your own data.",
  },
  {
    q: "Is my data safe?",
    a: "You sign in only with Google, so there is no Pluto password to leak. Access tokens are short-lived and refresh tokens rotate one at a time. Your data is used only to run the product — no ads, no trackers, no marketing profiles.",
  },
  {
    q: "How do I delete my account?",
    a: "Open the Delete account page, sign in with Google and confirm. Your profile, expenses, backups and sessions are erased immediately and permanently.",
  },
] as const;

function Item({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-2xl border border-border bg-surface px-5 py-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-sm font-medium text-ink marker:hidden">
        <span>{q}</span>
        <span
          aria-hidden="true"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-muted text-muted transition-transform duration-200 group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <p className="mt-3 text-sm leading-relaxed text-muted">{a}</p>
    </details>
  );
}

export function Faq() {
  const left = FAQ.slice(0, 3);
  const right = FAQ.slice(3);
  return (
    <div className="grid items-start gap-4 lg:grid-cols-2 lg:gap-5">
      <div className="space-y-4">
        {left.map((item) => (
          <Item key={item.q} {...item} />
        ))}
      </div>
      <div className="space-y-4">
        {right.map((item) => (
          <Item key={item.q} {...item} />
        ))}
      </div>
    </div>
  );
}
