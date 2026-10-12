/**
 * Thin emerald line chart with a gradient fill fading to transparent.
 *
 * Pure SVG plus a CSS draw-in animation (the `chart-draw` keyframes live in
 * `globals.css`), so it renders on the server and needs no JavaScript. The
 * line is authored with `pathLength="1"` so the dash maths are
 * resolution-independent.
 */

type Point = { x: number; y: number };

/** Catmull-Rom smoothing, rendered as cubic béziers. */
function smoothPath(points: Point[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

export function SpendTrendChart({
  values,
  id = "spend-trend",
  className = "",
}: {
  values: number[];
  /** Unique id so the gradient cannot collide with another chart. */
  id?: string;
  className?: string;
}) {
  const W = 560;
  const H = 180;
  const PAD = 16;

  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const stepX = values.length > 1 ? (W - PAD * 2) / (values.length - 1) : 0;

  const points: Point[] = values.map((value, i) => ({
    x: PAD + i * stepX,
    y: PAD + (1 - (value - min) / span) * (H - PAD * 2),
  }));

  const line = smoothPath(points);
  const last = points[points.length - 1];
  const area = `${line} L ${last.x} ${H} L ${points[0].x} ${H} Z`;
  const gridline = [0.25, 0.5, 0.75].map((t) => PAD + t * (H - PAD * 2));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Illustrative spending trend"
      className={className}
    >
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-stroke`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#6ee7b7" />
        </linearGradient>
      </defs>

      {gridline.map((y) => (
        <line
          key={y}
          x1={PAD}
          x2={W - PAD}
          y1={y}
          y2={y}
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      ))}

      <path d={area} fill={`url(#${id}-fill)`} />
      <path
        d={line}
        fill="none"
        stroke={`url(#${id}-stroke)`}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        vectorEffect="non-scaling-stroke"
        className="[animation:chart-draw_1.6s_ease-out_forwards]"
      />
      <circle cx={last.x} cy={last.y} r="4" fill="#34d399" />
      <circle cx={last.x} cy={last.y} r="9" fill="#34d399" opacity="0.18" />
    </svg>
  );
}
