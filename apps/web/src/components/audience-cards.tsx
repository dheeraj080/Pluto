/**
 * "Built for people who cross borders" — three static cards, no tabs.
 *
 * Each card is one sentence plus one mini example that uses exactly two
 * currencies: the one paid in and the one thought in.
 */

import type { ReactNode } from "react";
import { IconGlobe, IconGraduation, IconPlane } from "./icons";

type Audience = {
  icon: ReactNode;
  title: string;
  body: string;
  example: { label: string; paid: string; converted: string };
};

const AUDIENCES: Audience[] = [
  {
    icon: <IconGraduation className="h-5 w-5" />,
    title: "Students",
    body: "Tuition and rent are paid abroad, while the money still comes from home.",
    example: { label: "Rent", paid: "€480", converted: "₹43,200" },
  },
  {
    icon: <IconGlobe className="h-5 w-5" />,
    title: "Expats",
    body: "A salary in one currency, a whole life in another.",
    example: { label: "Salary", paid: "£2,400", converted: "₹2,52,000" },
  },
  {
    icon: <IconPlane className="h-5 w-5" />,
    title: "Tourists",
    body: "A whole trip, added up in the money back home.",
    example: { label: "Trip total", paid: "€860", converted: "₹77,400" },
  },
];

export function AudienceCards() {
  return (
    <div className="grid gap-4 sm:gap-5 md:grid-cols-3">
      {AUDIENCES.map((audience) => (
        <article
          key={audience.title}
          className="flex flex-col rounded-2xl border border-border bg-surface p-6"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-muted text-ink">
            {audience.icon}
          </span>
          <h3 className="mt-4 font-display text-lg font-semibold tracking-tight text-ink">
            {audience.title}
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{audience.body}</p>

          <div className="mt-auto pt-5">
            <div className="rounded-2xl border border-border bg-canvas px-4 py-3">
              <p className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted">
                {audience.example.label}
              </p>
              <p className="mt-1 text-sm tabular-nums">
                <span className="text-muted">{audience.example.paid}</span>
                <span className="mx-1.5 text-accent">→</span>
                <span className="font-semibold text-ink">{audience.example.converted}</span>
              </p>
            </div>
            <p className="mt-2 text-[11px] text-muted">Illustrative</p>
          </div>
        </article>
      ))}
    </div>
  );
}
