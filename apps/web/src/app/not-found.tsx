import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
        404
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
        Page not found
      </h1>
      <p className="mt-3 max-w-md text-muted">
        The page you are looking for does not exist or may have been moved.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover"
      >
        Back to home
      </Link>
    </div>
  );
}
