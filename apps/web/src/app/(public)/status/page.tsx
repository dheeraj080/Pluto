import type { Metadata } from "next";
import { StatusDashboard } from "./status-dashboard";

export const metadata: Metadata = {
  title: "Service status",
  description: "Live health of the Pluto API, database, and exchange-rate feed.",
  robots: { index: false, follow: true },
};

export default function StatusPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Service status</h1>
      <p className="mt-2 text-muted">
        Live health of the API, database, and exchange-rate feed.
      </p>
      <div className="mt-8">
        <StatusDashboard />
      </div>
    </div>
  );
}
