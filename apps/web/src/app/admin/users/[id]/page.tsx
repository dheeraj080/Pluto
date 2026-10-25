"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatBytes, formatDateTime, truncate } from "@/lib/format";
import type { AdminUserDetail } from "@/lib/types";
import {
  Badge,
  Button,
  Card,
  ErrorNote,
  LoadingNote,
  PageHeader,
  Table,
} from "@/components/ui";

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setUser(await api.get<AdminUserDetail>(`/admin/users/${id}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load user.");
    }
  }, [id]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const revokeSession = async (sessionId: string) => {
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/admin/users/${id}/sessions/${sessionId}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke session.");
    } finally {
      setBusy(false);
    }
  };

  const deleteBackup = async (backupId: string) => {
    if (!window.confirm("Delete this backup permanently? The storage object is removed too.")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/admin/backups/${backupId}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete backup.");
    } finally {
      setBusy(false);
    }
  };

  const deleteUser = async () => {
    if (
      !window.confirm(
        "Delete this account permanently? Profile, backups, and sessions are destroyed. This cannot be undone.",
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/admin/users/${id}`);
      router.push("/admin/users");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user.");
      setBusy(false);
    }
  };

  if (error && !user) return <ErrorNote message={error} />;
  if (!user) return <LoadingNote label="Loading user…" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={user.email}
        description={`Joined ${formatDateTime(user.createdAt)}`}
        action={
          <div className="flex gap-2">
            <Link
              href="/admin/users"
              className="rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-background"
            >
              ← Back
            </Link>
            <Button tone="danger" onClick={() => void deleteUser()} disabled={busy}>
              Delete user
            </Button>
          </div>
        }
      />

      {error && <ErrorNote message={error} />}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-background p-5">
          <p className="text-sm text-muted">Role</p>
          <div className="mt-1">
            <Badge tone={user.role === "ADMIN" ? "accent" : "neutral"}>{user.role}</Badge>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-background p-5">
          <p className="text-sm text-muted">Backups</p>
          <p className="mt-1 text-2xl font-semibold">{user.backupCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-5">
          <p className="text-sm text-muted">Active sessions</p>
          <p className="mt-1 text-2xl font-semibold">{user.activeSessionCount}</p>
        </div>
      </div>

      <Card title={`Sessions (newest 20)`}>
        {user.sessions.length === 0 ? (
          <p className="text-sm text-muted">No sessions recorded.</p>
        ) : (
          <Table headers={["Created", "IP", "User agent", "Expires", "Status", ""]}>
            {user.sessions.map((session) => (
              <tr key={session.id}>
                <td className="px-4 py-3">{formatDateTime(session.createdAt)}</td>
                <td className="px-4 py-3 font-mono">{session.ipAddress ?? "—"}</td>
                <td className="px-4 py-3 text-muted" title={session.userAgent ?? undefined}>
                  {session.userAgent ? truncate(session.userAgent, 40) : "—"}
                </td>
                <td className="px-4 py-3">{formatDateTime(session.expiresAt)}</td>
                <td className="px-4 py-3">
                  <Badge tone={session.isRevoked ? "danger" : "ok"}>
                    {session.isRevoked ? "revoked" : "active"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  {!session.isRevoked && (
                    <Button onClick={() => void revokeSession(session.id)} disabled={busy}>
                      Revoke
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title={`Backups (newest 20)`}>
        {user.backups.length === 0 ? (
          <p className="text-sm text-muted">No backups.</p>
        ) : (
          <Table headers={["Seq", "App", "Schema", "Size", "Status", "Created", ""]}>
            {user.backups.map((backup) => (
              <tr key={backup.id}>
                <td className="px-4 py-3 font-mono">#{backup.sequenceNumber}</td>
                <td className="px-4 py-3 font-mono">{backup.appVersion}</td>
                <td className="px-4 py-3 font-mono">{backup.schemaVersion}</td>
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
                  <Button tone="danger" onClick={() => void deleteBackup(backup.id)} disabled={busy}>
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
