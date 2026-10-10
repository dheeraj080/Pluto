"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { AdminLock, HealthReport } from "@/lib/types";
import {
  Badge,
  Card,
  ErrorNote,
  LoadingNote,
  PageHeader,
  StatCard,
} from "@/components/ui";

export default function AdminSystemPage() {
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [locks, setLocks] = useState<AdminLock[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [healthRes, locksRes] = await Promise.all([
        api.get<HealthReport>("/health"),
        api.get<AdminLock[]>("/admin/locks"),
      ]);
      setHealth(healthRes);
      setLocks(locksRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load system status.");
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="System"
        description="API health, database connectivity, and distributed locks."
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
      {!health && !error && <LoadingNote label="Checking health…" />}

      {health && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="API"
              value={
                <Badge tone={health.status === "ok" ? "ok" : "danger"}>{health.status}</Badge>
              }
            />
            <StatCard
              label="Database"
              value={
                <Badge
                  tone={health.database.status === "connected" ? "ok" : "danger"}
                >
                  {health.database.status}
                </Badge>
              }
            />
            <StatCard
              label="Latency"
              value={
                <span className="font-mono text-xl">
                  {health.database.latencyMs !== undefined ? `${health.database.latencyMs} ms` : "—"}
                </span>
              }
            />
            <StatCard label="Environment" value={<span className="text-xl">{health.environment}</span>} />
          </div>

          {health.database.error && <ErrorNote message={`Database: ${health.database.error}`} />}

          <Card title="Scheduler locks">
            {locks && locks.length === 0 ? (
              <p className="text-sm text-muted">No locks recorded.</p>
            ) : (
              locks && (
                <ul className="divide-y divide-border text-sm">
                  {locks.map((lock) => (
                    <li key={lock.lockName} className="flex flex-wrap justify-between gap-2 py-2">
                      <span className="font-mono font-medium">{lock.lockName}</span>
                      <span className="text-muted">
                        {lock.lockedBy} · until {formatDateTime(lock.lockedUntil)} · updated{" "}
                        {formatDateTime(lock.updatedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )
            )}
          </Card>

          <p className="text-xs text-muted">
            Checked {formatDateTime(health.timestamp)} · uptime{" "}
            {Math.floor(health.uptime / 3600)}h {Math.floor((health.uptime % 3600) / 60)}m
          </p>
        </>
      )}
    </div>
  );
}
