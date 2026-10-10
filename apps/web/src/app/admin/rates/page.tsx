"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { AdminRateSnapshot } from "@/lib/types";
import { Badge, ErrorNote, LoadingNote, PageHeader, Table } from "@/components/ui";

export default function AdminRatesPage() {
  const [snapshots, setSnapshots] = useState<AdminRateSnapshot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSnapshots(await api.get<AdminRateSnapshot[]>("/admin/rates?limit=30"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load snapshots.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exchange rates"
        description="Snapshot history — each snapshot represents one successful provider sync."
        action={
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-background"
          >
            Refresh
          </button>
        }
      />

      {error && <ErrorNote message={error} />}
      {loading && !snapshots && <LoadingNote label="Loading snapshots…" />}

      {snapshots && (
        <Table headers={["Version", "Base", "Effective", "Fetched", "Provider", "Rates", "State"]}>
          {snapshots.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-muted">
                No snapshots yet — the first sync runs on the configured schedule.
              </td>
            </tr>
          )}
          {snapshots.map((snapshot, index) => (
            <tr key={snapshot.version} className="hover:bg-background/60">
              <td className="px-4 py-3 font-mono font-medium">
                v{snapshot.version}
                {index === 0 && <span className="ml-2 text-xs text-accent">latest</span>}
              </td>
              <td className="px-4 py-3 font-mono">{snapshot.baseCurrency}</td>
              <td className="px-4 py-3 font-mono">{snapshot.effectiveDate.slice(0, 10)}</td>
              <td className="px-4 py-3 text-muted">{formatDateTime(snapshot.fetchedAt)}</td>
              <td className="px-4 py-3 font-mono text-sm">{snapshot.provider}</td>
              <td className="px-4 py-3 font-mono">{snapshot.rateCount}</td>
              <td className="px-4 py-3">
                <Badge tone={snapshot.isPublished ? "ok" : "warn"}>
                  {snapshot.isPublished ? "published" : "pending"}
                </Badge>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
