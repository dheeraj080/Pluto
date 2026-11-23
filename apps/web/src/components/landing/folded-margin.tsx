import Link from "next/link";
import {
  IconArrowRight,
  IconChevronDown,
  IconGoogle,
  IconShieldCheck,
  IconSmartphone,
} from "@/components/icons";
import { FoldDemo } from "./fold-demo";

const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.pluto.app";

function ActionPlaques({ closing = false }: { closing?: boolean }) {
  return (
    <div className="fm-plaques">
      <Link href="/login" className="fm-plaque fm-plaque--web">
        <IconGoogle className="fm-plaque__icon" />
        <span className="fm-plaque__text">
          <strong>Start on the web</strong>
          <small>Google sign-in · your account in the browser</small>
        </span>
        <IconArrowRight className="fm-plaque__arrow" />
      </Link>
      <a
        href={PLAY_STORE_URL}
        className="fm-plaque fm-plaque--android"
        target="_blank"
        rel="noopener noreferrer"
      >
        <IconSmartphone className="fm-plaque__icon" />
        <span className="fm-plaque__text">
          <strong>Get the Android app</strong>
          <small>Record a purchase while you are out</small>
        </span>
        <IconArrowRight className="fm-plaque__arrow" />
      </a>
      {closing ? <span className="fm-plaques__note">Both apps use the same account.</span> : null}
    </div>
  );
}

export function FoldedMarginPage() {
  return (
    <div className="fm-page">
      <section className="fm-hero" id="top">
        <div className="fm-hero__grid">
          <div className="fm-hero__copy">
            <h1 className="fm-display">The same price, in your money.</h1>
            <p className="fm-lede">
              Pluto records what you pay in the currency on the tag and shows your totals in the currency you use at home. You see both numbers together, with the daily rate that connects them.
            </p>
            <ActionPlaques />
          </div>
          <div className="fm-hero__artifact">
            <FoldDemo />
          </div>
        </div>
      </section>

      <section className="fm-section" id="the-problem">
        <div className="fm-section__folio" aria-hidden="true">Marginalia / 01</div>
        <div className="fm-section__body">
          <h2 className="fm-heading">A price in another currency is only half an answer.</h2>
          <p className="fm-copy">
            You can read the number on the tag. What you cannot see is what it does to your month. The useful figure lives somewhere else.
          </p>
          <ol className="fm-ledger">
            <li className="fm-ledger__row">
              <span className="fm-ledger__mark" aria-hidden="true" />
              <div>
                <h3>The receipt</h3>
                <p>€38.20 at the till. Accurate, but it does not tell you what is left before your next transfer.</p>
              </div>
              <span className="fm-ledger__aside">No running total</span>
            </li>
            <li className="fm-ledger__row">
              <span className="fm-ledger__mark" aria-hidden="true" />
              <div>
                <h3>The bank app</h3>
                <p>A converted amount for today. Not a budget, and not the whole trip in one view.</p>
              </div>
              <span className="fm-ledger__aside">No context</span>
            </li>
            <li className="fm-ledger__row">
              <span className="fm-ledger__mark" aria-hidden="true" />
              <div>
                <h3>Mental maths</h3>
                <p>Doing the conversion again at every shop is how a small purchase becomes a long habit.</p>
              </div>
              <span className="fm-ledger__aside">Not again</span>
            </li>
          </ol>
        </div>
      </section>

      <section className="fm-section fm-section--rule" id="how-it-works">
        <div className="fm-section__folio" aria-hidden="true">The fold / 02</div>
        <div className="fm-section__body">
          <h2 className="fm-heading">One fold. Both numbers.</h2>
          <p className="fm-copy">
            Pluto keeps the two figures on the same line, so you never have to carry the exchange rate in your head.
          </p>
          <ol className="fm-steps">
            <li className="fm-step">
              <span className="fm-step__no">01</span>
              <div className="fm-step__text">
                <h3>Write it down</h3>
                <p>Enter the amount in the currency you actually paid. Categories and budgets stay in your hands.</p>
              </div>
            </li>
            <li className="fm-step">
              <span className="fm-step__no">02</span>
              <div className="fm-step__text">
                <h3>Let the rate do the work</h3>
                <p>Daily European Central Bank reference rates convert your spending into the base currency you choose.</p>
              </div>
            </li>
            <li className="fm-step">
              <span className="fm-step__no">03</span>
              <div className="fm-step__text">
                <h3>Read the whole page</h3>
                <p>See budget against actual, monthly trends and category breakdowns. Click a chart to reach the expenses behind it.</p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section className="fm-section" id="features">
        <div className="fm-section__folio" aria-hidden="true">The page / 03</div>
        <div className="fm-section__body">
          <h2 className="fm-heading">What the fold holds.</h2>
          <p className="fm-copy">
            Everything you need for an ordinary month abroad, in plain figures and short sentences.
          </p>
          <dl className="fm-spec">
            <div className="fm-spec__row">
              <dt>Daily reference rates</dt>
              <dd>European Central Bank rates, with the rate behind each converted figure.</dd>
            </div>
            <div className="fm-spec__row">
              <dt>Any currency in, one currency out</dt>
              <dd>Record in the currency you paid; choose the base currency you think in.</dd>
            </div>
            <div className="fm-spec__row">
              <dt>Budgets and categories</dt>
              <dd>Set a monthly amount, then see what is used and what is left.</dd>
            </div>
            <div className="fm-spec__row">
              <dt>Reports you can follow</dt>
              <dd>Monthly trend, weekday pattern and category breakdown, with click-through and CSV export.</dd>
            </div>
            <div className="fm-spec__row">
              <dt>Web and Android</dt>
              <dd>One Google account, the same expenses, on the device in front of you.</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="fm-section fm-section--paper" id="life-abroad">
        <div className="fm-section__folio" aria-hidden="true">Field notes / 04</div>
        <div className="fm-section__body">
          <h2 className="fm-heading">For the long way home.</h2>
          <div className="fm-notes">
            <article className="fm-note">
              <span className="fm-note__route">EUR → INR · one semester</span>
              <h3>Students</h3>
              <p>Money arrives from home. The question is simple: how much is left before the next transfer?</p>
            </article>
            <article className="fm-note">
              <span className="fm-note__route">GBP → USD · one salary</span>
              <h3>Expats</h3>
              <p>A salary in one country and a whole life in another. Keep both sides of that life in view.</p>
            </article>
            <article className="fm-note">
              <span className="fm-note__route">JPY → AUD · one trip</span>
              <h3>Travellers</h3>
              <p>Several currencies, one honest total in the money you will use when you get back.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="fm-section fm-privacy">
        <div className="fm-section__folio" aria-hidden="true">In the margin / 05</div>
        <div className="fm-section__body fm-privacy__grid">
          <div>
            <h2 className="fm-heading fm-heading--tight">Quiet by design.</h2>
            <IconShieldCheck className="fm-privacy__icon" aria-hidden="true" />
          </div>
          <div className="fm-privacy__copy">
            <p className="fm-copy">
              Pluto is a travel companion, not a bank. No ads, no trackers, no invented statistics. Your expenses belong to you, and account deletion is a first-class flow.
            </p>
            <p className="fm-links">
              <Link href="/privacy">Privacy policy</Link>
              <Link href="/terms">Terms</Link>
              <Link href="/delete-account">Delete account</Link>
            </p>
          </div>
        </div>
      </section>

      <section className="fm-section" id="faq">
        <div className="fm-section__folio" aria-hidden="true">Questions / 06</div>
        <div className="fm-section__body">
          <h2 className="fm-heading">Honest answers.</h2>
          <div className="fm-faq">
            <details>
              <summary>Which rate does Pluto use?<IconChevronDown aria-hidden="true" /></summary>
              <p>Daily European Central Bank reference rates. Every converted figure can be traced back to the rate that produced it.</p>
            </details>
            <details>
              <summary>Can I enter any currency?<IconChevronDown aria-hidden="true" /></summary>
              <p>Yes. Record a purchase in the currency you paid, then choose the base currency for your reports.</p>
            </details>
            <details>
              <summary>Do I need the Android app?<IconChevronDown aria-hidden="true" /></summary>
              <p>No. The web app has the full expense tracker. The Android app is there for the moment you are standing at the till.</p>
            </details>
            <details>
              <summary>What happens if a rate is missing?<IconChevronDown aria-hidden="true" /></summary>
              <p>Native per-currency figures still appear. Converted totals show as unavailable rather than as a wrong number.</p>
            </details>
            <details>
              <summary>How do I close my account?<IconChevronDown aria-hidden="true" /></summary>
              <p>Use the delete-account page. It signs you in, offers a backup export, and then removes your account.</p>
            </details>
          </div>
        </div>
      </section>

      <section className="fm-close" id="start">
        <div className="fm-close__inner">
          <h2 className="fm-display fm-display--close">Start with the next price you cannot read.</h2>
          <p className="fm-lede">
            One account. Web and Android. Both numbers on the same page.
          </p>
          <ActionPlaques closing />
        </div>
      </section>
    </div>
  );
}
