"use client";

/**
 * The few icons Reports adds on top of the shared set: the chart/table toggle
 * pair and a download mark for the CSV export. Kept local so the report screen
 * does not edit the shared icon module while other screens are in flight.
 */

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Svg({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

/** A line-chart glyph — the "show the chart" side of the toggle. */
export function IconChartLine(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 17.5 9 11l3.5 3.5L20.5 6" />
      <path d="M3.5 20.5h17" />
    </Svg>
  );
}

/** A small grid glyph — the "show the data table" side of the toggle. */
export function IconTable(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="1.8" />
      <path d="M3.5 9.5h17" />
      <path d="M3.5 14.5h17" />
      <path d="M9.5 4.5v15" />
    </Svg>
  );
}

/** A downward arrow into a tray — export. */
export function IconDownload(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4v10" />
      <path d="M8 10.5 12 14.5 16 10.5" />
      <path d="M4.5 19.5h15" />
    </Svg>
  );
}
