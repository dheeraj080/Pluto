/**
 * Category colour marks.
 *
 * Colour is always paired with the category name — a dot on its own is never
 * the only signal, so the meaning survives for colour-blind users and in
 * greyscale.
 */

export function CategorySwatch({
  color,
  size = 10,
  className = "",
}: {
  /** Hex colour as stored on the category. */
  color: string;
  /** Diameter in pixels. */
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 rounded-full ${className}`}
      style={{ width: size, height: size, backgroundColor: color }}
    />
  );
}

export function CategoryTag({
  color,
  name,
  className = "",
}: {
  color: string;
  name: string;
  className?: string;
}) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-2 ${className}`}>
      <CategorySwatch color={color} />
      <span className="truncate text-muted">{name}</span>
    </span>
  );
}
