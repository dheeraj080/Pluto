/**
 * Minimal stroke icon set (24×24, currentColor). Dependency-free — matches
 * the rest of the web app, which avoids icon/UI libraries.
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

export function IconHome(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 10.5 12 3.25 20.5 10.5" />
      <path d="M5.5 9.25V20h13V9.25" />
      <path d="M9.5 20v-6h5v6" />
    </Svg>
  );
}

export function IconChart(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M20.5 20H3.5" />
    </Svg>
  );
}

export function IconWallet(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h12.5A1.5 1.5 0 0 1 19 7.5V9" />
      <path d="M3.5 7.5V17A1.5 1.5 0 0 0 5 18.5h14A1.5 1.5 0 0 0 20.5 17V9" />
      <path d="M3.5 7.5V9h17" />
      <path d="M15.5 13h1" />
    </Svg>
  );
}

export function IconTag(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12.6 3.3 20.7 11.4a1.6 1.6 0 0 1 0 2.3l-7 7a1.6 1.6 0 0 1-2.3 0L3.3 12.6a1.6 1.6 0 0 1-.47-1.13V4.6A1.3 1.3 0 0 1 4.13 3.3h6.87c.42 0 .83.17 1.13.47z" />
      <circle cx="8.3" cy="8.3" r="1.3" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </Svg>
  );
}

export function IconArrowRight(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.5 12h15" />
      <path d="M13.5 6 19.5 12l-6 6" />
    </Svg>
  );
}

export function IconArrowLeft(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M19.5 12h-15" />
      <path d="M10.5 6 4.5 12l6 6" />
    </Svg>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-3.8-3.8" />
    </Svg>
  );
}

export function IconTrash(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.5 6.5h15" />
      <path d="M9 6.5V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1.5" />
      <path d="M6.5 6.5 7.5 20h9l1-13.5" />
      <path d="M10 10v6.5" />
      <path d="M14 10v6.5" />
    </Svg>
  );
}

export function IconLogOut(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M15 4.5h3.5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H15" />
      <path d="M10 12h9.5" />
      <path d="M16.5 8.5 20 12l-3.5 3.5" />
      <path d="M4 4.5h9v15H4" />
    </Svg>
  );
}

export function IconMenu(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 6.5h16" />
      <path d="M4 12h16" />
      <path d="M4 17.5h16" />
    </Svg>
  );
}

export function IconClose(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </Svg>
  );
}

export function IconGlobe(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17" />
      <path d="M12 3.5c2.2 2.3 3.3 5.2 3.3 8.5s-1.1 6.2-3.3 8.5c-2.2-2.3-3.3-5.2-3.3-8.5s1.1-6.2 3.3-8.5z" />
    </Svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />
    </Svg>
  );
}

export function IconAlert(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4 21.2 19H2.8z" />
      <path d="M12 9.5V13" />
      <path d="M12 16h.01" />
    </Svg>
  );
}

export function IconCalendar(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="5.5" width="16" height="15" rx="2" />
      <path d="M4 10h16" />
      <path d="M8.5 3.5v4" />
      <path d="M15.5 3.5v4" />
    </Svg>
  );
}

export function IconShield(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.5 19 6v5c0 4.4-2.9 8.1-7 9.5C7.9 19.1 5 15.4 5 11V6z" />
      <path d="M9 11.5 11 13.5 15.5 9" />
    </Svg>
  );
}

export function IconSwap(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 8h13" />
      <path d="M14 4.5 17.5 8 14 11.5" />
      <path d="M20 16H7" />
      <path d="M10 12.5 6.5 16l3.5 3.5" />
    </Svg>
  );
}

export function IconReceipt(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 3.5h12A1 1 0 0 1 19 4.5v15.2l-2.4-1.6-2.1 1.6-2.5-1.6-2.5 1.6-2.1-1.6-2.4 1.6V4.5a1 1 0 0 1 1-1z" />
      <path d="M9 8.5h6" />
      <path d="M9 12h6" />
    </Svg>
  );
}

export function IconBolt(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M13 3 5 13.5h5.5L10 21l8.5-11H13z" />
    </Svg>
  );
}

export function IconLock(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5.5" y="10.5" width="13" height="9.5" rx="2" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
      <path d="M12 14.5v2" />
    </Svg>
  );
}

export function IconChevronDown(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m6.5 9.5 5.5 5.5 5.5-5.5" />
    </Svg>
  );
}

export function IconSparkle(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4.5 13.6 10 19 12l-5.4 2L12 19.5 10.4 14 5 12l5.4-2z" />
    </Svg>
  );
}