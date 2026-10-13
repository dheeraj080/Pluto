"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatBytes, formatDateTime } from "@/lib/format";
import type { AdminBackup, BackupStatus, Paginated } from "@/lib/types";
import {
  Badge,
  Button,
  ErrorNote,
  LoadingNote,
  PageHeader,
  Pagination,
  Select,
  Table,
} from "@/components/ui";

const LIMIT = 20;
const STATUS_OPTIONS: Array<BackupStatus | ""> = ["", "COMPLETED", "PENDING", "FAILED", "DELETED"];

export default function AdminBackupsPage() {
  const [status, setStatus] = useState<BackupStatus | "">("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<AdminBackup> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (status) params.set("status", status);
      setData(await api.get<Paginated<AdminBackup>>(`/admin/backups?${params}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load backups.");
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const deleteBackup = async (backup: AdminBackup) => {
    if (
      !window.confirm(
        `Delete backup #${backup.sequenceNumber} of ${backup.userEmail}? The storage object is removed permanently.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/admin/backups/${backup.id}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete backup.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Backups"
        description="Every backup across all users, newest first."
        action={
          <Select
            value={status}
            onChange={(value) => {
              setPage(1);
              setStatus(value as BackupStatus | "");
            }}
            aria-label="Filter backups by status"
            className="w-44"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option || "all"} value={option}>
                {option || "All statuses"}
              </option>
            ))}
          </Select>
        }
      />

      {error && <ErrorNote message={error} />}
      {loading && !data && <LoadingNote label="Loading backups…" />}

      {data && (
        <>
          <Table headers={["User", "Seq", "App", "Size", "Status", "Created", ""]}>
            {data.items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted">
                  No backups found.
                </td>
              </tr>
            )}
            {data.items.map((backup) => (
              <tr key={backup.id} className="hover:bg-background/60">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/users/${backup.userId}`}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    {backup.userEmail}
                  </Link>
                </td>
                <td className="px-4 py-3 font-mono">#{backup.sequenceNumber}</td>
                <td className="px-4 py-3 font-mono">{backup.appVersion}</td>
                <td className="px-4 py-3 font-mono">{formatBytes(backup.fileSizeBytes)}</td>
                <td className="px-4 py-3">
                  <Badge
                    tone={
                      backup.status === "COMPLETED"
                        ? "ok"
                        : backup.status === "PENDING"
                          ? "warn"
                          : "danger"
                    }
                  >
                    {backup.status.toLowerCase()}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-muted">{formatDateTime(backup.createdAt)}</td>
                <td className="px-4 py-3 text-right">
                  <Button tone="danger" onClick={() => void deleteBackup(backup)} disabled={busy}>
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
          <Pagination page={data.page} total={data.total} limit={data.limit} onPage={setPage} />
        </>
      )}
    </div>
  );
}
