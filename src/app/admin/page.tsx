"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatBytes, formatDateTime } from "@/lib/format";
import type { AdminLock, AdminStats } from "@/lib/types";
import { Card, ErrorNote, LoadingNote, PageHeader, StatCard } from "@/components/admin/ui";

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [locks, setLocks] = useState<AdminLock[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, locksRes] = await Promise.all([
        api.get<AdminStats>("/admin/stats"),
        api.get<AdminLock[]>("/admin/locks"),
      ]);
      setStats(statsRes);
      setLocks(locksRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load statistics.");
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
        title="Overview"
        description="Service-wide counts, storage usage, and scheduler locks."
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
      {loading && !stats && <LoadingNote label="Loading statistics…" />}

      {stats && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Users" value={stats.totalUsers.toLocaleString()} />
            <StatCard label="Backups" value={stats.totalBackups.toLocaleString()} />
            <StatCard label="Storage used" value={formatBytes(stats.totalStorageBytes)} />
            <StatCard label="Active sessions" value={stats.activeSessions.toLocaleString()} />
          </div>

          <Card title="Latest rate snapshot">
            {stats.lastRateSnapshot ? (
              <dl className="grid gap-3 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-muted">Version</dt>
                  <dd className="font-mono font-medium">v{stats.lastRateSnapshot.version}</dd>
                </div>
                <div>
                  <dt className="text-muted">Base</dt>
                  <dd className="font-mono font-medium">{stats.lastRateSnapshot.baseCurrency}</dd>
                </div>
                <div>
                  <dt className="text-muted">Effective</dt>
                  <dd className="font-mono font-medium">
                    {stats.lastRateSnapshot.effectiveDate.slice(0, 10)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Fetched</dt>
                  <dd className="font-mono font-medium">
                    {formatDateTime(stats.lastRateSnapshot.fetchedAt)}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-muted">No published snapshot yet.</p>
            )}
          </Card>

          <Card title="Scheduler locks">
            {locks.length === 0 ? (
              <p className="text-sm text-muted">No locks recorded.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {locks.map((lock) => (
                  <li key={lock.lockName} className="flex flex-wrap justify-between gap-2 py-2">
                    <span className="font-mono font-medium">{lock.lockName}</span>
                    <span className="text-muted">
                      held by {lock.lockedBy} · until {formatDateTime(lock.lockedUntil)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
