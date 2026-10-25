"use client";

/** Client-side status dashboard: GET /v1/health + GET /v1/rates/latest, auto-refreshed. */

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { HealthReport, RateSnapshot } from "@/lib/types";

const REFRESH_MS = 60_000;

type CardState<T> =
  | { kind: "loading" }
  | { kind: "ok"; data: T }
  | { kind: "error"; message: string };

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${Math.floor(seconds)}s`;
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-2.5 w-2.5 rounded-full ${ok ? "bg-success" : "bg-danger"}`}
    />
  );
}

function CardShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function StatusDashboard() {
  const [health, setHealth] = useState<CardState<HealthReport>>({ kind: "loading" });
  const [rates, setRates] = useState<CardState<RateSnapshot>>({ kind: "loading" });
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [healthRes, ratesRes] = await Promise.allSettled([
      api.get<HealthReport>("/health"),
      api.get<RateSnapshot>("/rates/latest"),
    ]);

    setHealth(
      healthRes.status === "fulfilled"
        ? { kind: "ok", data: healthRes.value }
        : {
            kind: "error",
            message:
              healthRes.reason instanceof Error
                ? healthRes.reason.message
                : "API unreachable",
          },
    );
    setRates(
      ratesRes.status === "fulfilled"
        ? { kind: "ok", data: ratesRes.value }
        : {
            kind: "error",
            message:
              ratesRes.reason instanceof Error
                ? ratesRes.reason.message
                : "Rates feed unreachable",
          },
    );
    setCheckedAt(new Date().toLocaleTimeString());
  }, []);

  useEffect(() => {
    // Deferred so the effect body doesn't trigger synchronous state updates;
    // the first check runs on the next tick, then every REFRESH_MS.
    const initial = setTimeout(() => void refresh(), 0);
    const id = setInterval(() => void refresh(), REFRESH_MS);
    return () => {
      clearTimeout(initial);
      clearInterval(id);
    };
  }, [refresh]);

  const overallOk = health.kind === "ok" && health.data.status === "ok";

  return (
    <div className="space-y-4">
      {/* Overall banner */}
      <div
        className={`flex items-center gap-3 rounded-xl border p-4 ${
          health.kind === "loading"
            ? "border-border"
            : overallOk
              ? "border-success/40"
              : "border-danger/40"
        }`}
        role="status"
      >
        {health.kind === "loading" ? (
          <span className="text-sm text-muted">Checking…</span>
        ) : (
          <>
            <StatusDot ok={overallOk} />
            <p className="font-medium">
              {overallOk ? "All systems operational" : "Degraded or unreachable"}
            </p>
          </>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* API */}
        <CardShell title="API">
          {health.kind === "loading" && <p className="text-sm text-muted">Loading…</p>}
          {health.kind === "error" && (
            <p className="text-sm text-danger">{health.message}</p>
          )}
          {health.kind === "ok" && (
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Status</dt>
                <dd className="flex items-center gap-2 font-medium">
                  <StatusDot ok={health.data.status === "ok"} />
                  {health.data.status}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Uptime</dt>
                <dd className="font-mono">{formatUptime(health.data.uptime)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Environment</dt>
                <dd className="font-mono">{health.data.environment}</dd>
              </div>
            </dl>
          )}
        </CardShell>

        {/* Database */}
        <CardShell title="Database">
          {health.kind === "loading" && <p className="text-sm text-muted">Loading…</p>}
          {health.kind === "error" && (
            <p className="text-sm text-danger">Could not reach the API.</p>
          )}
          {health.kind === "ok" && (
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Status</dt>
                <dd className="flex items-center gap-2 font-medium">
                  <StatusDot ok={health.data.database.status === "connected"} />
                  {health.data.database.status}
                </dd>
              </div>
              {health.data.database.latencyMs !== undefined && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Latency</dt>
                  <dd className="font-mono">{health.data.database.latencyMs} ms</dd>
                </div>
              )}
              {health.data.database.error && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Error</dt>
                  <dd className="text-danger">{health.data.database.error}</dd>
                </div>
              )}
            </dl>
          )}
        </CardShell>

        {/* Rates feed */}
        <CardShell title="Exchange rates">
          {rates.kind === "loading" && <p className="text-sm text-muted">Loading…</p>}
          {rates.kind === "error" && <p className="text-sm text-danger">{rates.message}</p>}
          {rates.kind === "ok" && (
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Effective date</dt>
                <dd className="font-mono">{rates.data.effectiveDate}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Snapshot</dt>
                <dd className="font-mono">v{rates.data.version}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Provider</dt>
                <dd className="font-mono">{rates.data.provider}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Fetched</dt>
                <dd className="font-mono">
                  {new Date(rates.data.fetchedAt).toLocaleString()}
                </dd>
              </div>
            </dl>
          )}
        </CardShell>

        {/* Refresh control */}
        <CardShell title="Last checked">
          <p className="font-mono text-sm">{checkedAt ?? "—"}</p>
          <button
            type="button"
            onClick={refresh}
            className="mt-3 rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-background"
          >
            Refresh now
          </button>
          <p className="mt-2 text-xs text-muted">Auto-refreshes every 60 seconds.</p>
        </CardShell>
      </div>
    </div>
  );
}
