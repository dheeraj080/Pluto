"use client";

/**
 * Google Play data-deletion URL flow.
 *
 * sign-in (web Google Sign-In → POST /v1/auth/google)
 *   → optional backup export (GET /v1/backups, GET /v1/backups/:id/download)
 *   → typed confirmation
 *   → DELETE /v1/users/me → POST /v1/auth/logout → done
 */

import { useCallback, useState } from "react";
import Link from "next/link";
import { GoogleSignInButton } from "@/components/google-sign-in";
import { api, clearSession, getRefreshToken } from "@/lib/api";
import type {
  AuthSession,
  BackupMetadata,
  DownloadBackupResponse,
  Paginated,
} from "@/lib/types";

type Step = "signin" | "review" | "deleting" | "done";

const CONFIRM_PHRASE = "DELETE";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`;
}

export function DeleteAccountForm() {
  const [step, setStep] = useState<Step>("signin");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [backups, setBackups] = useState<BackupMetadata[] | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleSignedIn = useCallback(async (next: AuthSession) => {
    setSession(next);
    setError(null);
    setDownloadError(null);
    setConfirmText("");
    setStep("review");
    try {
      const page = await api.get<Paginated<BackupMetadata>>("/backups?limit=5");
      setBackups(page.items.filter((b) => b.status === "COMPLETED"));
    } catch {
      setBackups(null); // export list is optional — deletion must stay possible
    }
  }, []);

  const handleCancel = () => {
    clearSession();
    setSession(null);
    setBackups(null);
    setConfirmText("");
    setError(null);
    setStep("signin");
  };

  const handleDownload = async (backupId: string) => {
    setDownloadError(null);
    try {
      const res = await api.get<DownloadBackupResponse>(`/backups/${backupId}/download`);
      window.open(res.downloadUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Download failed.");
    }
  };

  const handleDelete = async () => {
    if (confirmText !== CONFIRM_PHRASE) return;
    setStep("deleting");
    setError(null);
    try {
      await api.delete<{ success: boolean; message: string }>("/users/me");
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        try {
          await api.post("/auth/logout", { refreshToken });
        } catch {
          /* account is already gone — nothing to revoke */
        }
      }
      clearSession();
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Account deletion failed.");
      setStep("review");
    }
  };

  if (step === "done") {
    return (
      <div className="mt-8 rounded-xl border border-border p-6">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="text-2xl text-success">
            ✓
          </span>
          <h2 className="text-xl font-semibold">Your account has been deleted</h2>
        </div>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          Your profile, cloud backups, and all active sessions have been permanently removed. Thank
          you for using Pluto.
        </p>
        <Link
          href="/"
          className="mt-5 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
        >
          Back to home
        </Link>
      </div>
    );
  }

  if (step === "deleting") {
    return (
      <div className="mt-8 rounded-xl border border-border p-6" role="status">
        <p className="text-[15px] text-muted">Deleting your account and backups…</p>
      </div>
    );
  }

  if (step === "signin") {
    return (
      <div className="mt-6 space-y-6 text-[15px] leading-relaxed">
        <p className="text-muted">
          This page permanently deletes your Pluto account. Before you continue, here is exactly
          what will happen:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            Your <strong>profile</strong> (email, name, avatar) is erased.
          </li>
          <li>
            <strong>Every cloud backup</strong> stored for your account is deleted — permanently
            and irreversibly.
          </li>
          <li>
            All active <strong>sessions and tokens</strong> are revoked immediately.
          </li>
        </ul>
        <div className="rounded-lg border border-border bg-background p-4 text-sm text-muted">
          Want a copy of your data first? Sign in below and you can download your backups before
          deleting. You can also export them from the app.
        </div>
        <div>
          <p className="mb-3 font-medium">Sign in to continue</p>
          <GoogleSignInButton onSignedIn={handleSignedIn} />
        </div>
        <p className="text-sm text-muted">
          Deletion is governed by our{" "}
          <Link href="/privacy" className="text-accent underline underline-offset-2">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    );
  }

  /* step === "review" */
  return (
    <div className="mt-6 space-y-6 text-[15px] leading-relaxed">
      <div className="rounded-xl border border-border p-4">
        <p className="text-sm text-muted">Signed in as</p>
        <div className="mt-1 flex items-center gap-3">
          {session?.user.avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.user.avatarUrl}
              alt=""
              className="h-9 w-9 rounded-full"
              referrerPolicy="no-referrer"
            />
          )}
          <div>
            <p className="font-medium">{session?.user.name ?? "Unnamed user"}</p>
            <p className="text-sm text-muted">{session?.user.email}</p>
          </div>
        </div>
      </div>

      <section>
        <h2 className="font-medium">1. Download a copy of your backups (optional)</h2>
        {backups === null ? (
          <p className="mt-2 text-sm text-muted">
            Could not load your backups — you can still proceed with deletion.
          </p>
        ) : backups.length === 0 ? (
          <p className="mt-2 text-sm text-muted">You have no completed backups.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
            {backups.map((backup) => (
              <li key={backup.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    Backup #{backup.sequenceNumber} · v{backup.appVersion}
                  </p>
                  <p className="text-xs text-muted">
                    {new Date(backup.createdAt).toLocaleDateString()} ·{" "}
                    {formatBytes(backup.fileSizeBytes)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownload(backup.id)}
                  className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-background"
                >
                  Download
                </button>
              </li>
            ))}
          </ul>
        )}
        {downloadError && (
          <p className="mt-2 text-sm text-danger" role="alert">
            {downloadError}
          </p>
        )}
      </section>

      <section>
        <h2 className="font-medium">2. Confirm deletion</h2>
        <p className="mt-2 text-sm text-muted">
          This action is <strong className="text-danger">immediate and irreversible</strong>. All
          backups will be destroyed.
        </p>
        <label htmlFor="confirm" className="mt-4 block text-sm font-medium">
          Type <code className="rounded bg-background px-1.5 py-0.5 font-mono">{CONFIRM_PHRASE}</code>{" "}
          to confirm
        </label>
        <input
          id="confirm"
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-danger"
          placeholder={CONFIRM_PHRASE}
        />
        {error && (
          <p className="mt-3 text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleDelete}
            disabled={confirmText !== CONFIRM_PHRASE}
            className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Permanently delete my account
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-background"
          >
            Cancel
          </button>
        </div>
      </section>
    </div>
  );
}
