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
import { Button, ErrorNote, Input, Spinner } from "@/components/ui";
import { IconCheck, IconTrash } from "@/components/icons";
import { api, clearSession, getRefreshToken } from "@/lib/api";
import { formatBytes } from "@/lib/format";
import type {
  AuthSession,
  BackupMetadata,
  DownloadBackupResponse,
  Paginated,
} from "@/lib/types";

type Step = "signin" | "review" | "deleting" | "done";

const CONFIRM_PHRASE = "DELETE";

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
      <div className="mt-8 rounded-2xl border border-border bg-background p-6 shadow-[0_1px_2px_rgba(23,33,27,0.04)]">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-success-subtle text-success">
            <IconCheck className="h-5 w-5" />
          </span>
          <h2 className="text-lg font-semibold text-ink">Your account has been deleted</h2>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Your profile, cloud backups, and all active sessions have been permanently removed. Thank
          you for using Pluto.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex h-10 items-center justify-center rounded-xl bg-primary px-5 text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover"
        >
          Back to home
        </Link>
      </div>
    );
  }

  if (step === "deleting") {
    return (
      <div
        className="mt-8 flex items-center gap-3 rounded-2xl border border-border bg-background p-6 text-sm text-muted"
        role="status"
      >
        <Spinner className="h-4 w-4" />
        Deleting your account and backups…
      </div>
    );
  }

  if (step === "signin") {
    return (
      <div className="mt-6 space-y-6 text-sm leading-relaxed">
        <p className="text-muted">
          This page permanently deletes your Pluto account. Before you continue, here is exactly
          what will happen:
        </p>
        <ul className="space-y-2">
          {[
            "Your profile (email, name, avatar) is erased.",
            "Every cloud backup stored for your account is deleted — permanently and irreversibly.",
            "All active sessions and tokens are revoked immediately.",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-danger-subtle text-danger">
                <IconTrash className="h-3 w-3" />
              </span>
              <span className="text-muted">{item}</span>
            </li>
          ))}
        </ul>
        <div className="rounded-xl border border-border bg-surface-muted/50 p-4 text-sm text-muted">
          Want a copy of your data first? Sign in below and you can download your backups before
          deleting. You can also export them from the app.
        </div>
        <div>
          <p className="mb-3 font-medium text-ink">Sign in to continue</p>
          <GoogleSignInButton onSignedIn={handleSignedIn} />
        </div>
        <p className="text-sm text-muted">
          Deletion is governed by our{" "}
          <Link href="/privacy" className="text-primary underline underline-offset-2">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    );
  }

  /* step === "review" */
  return (
    <div className="mt-6 space-y-6 text-sm leading-relaxed">
      <div className="rounded-xl border border-border bg-background p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted">Signed in as</p>
        <div className="mt-2 flex items-center gap-3">
          {session?.user.avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.user.avatarUrl}
              alt=""
              className="h-9 w-9 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          )}
          <div>
            <p className="font-medium text-ink">{session?.user.name ?? "Unnamed user"}</p>
            <p className="text-sm text-muted">{session?.user.email}</p>
          </div>
        </div>
      </div>

      <section>
        <h2 className="font-semibold text-ink">1. Download a copy of your backups (optional)</h2>
        {backups === null ? (
          <p className="mt-2 text-sm text-muted">
            Could not load your backups — you can still proceed with deletion.
          </p>
        ) : backups.length === 0 ? (
          <p className="mt-2 text-sm text-muted">You have no completed backups.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-background">
            {backups.map((backup) => (
              <li key={backup.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    Backup #{backup.sequenceNumber} · v{backup.appVersion}
                  </p>
                  <p className="text-xs text-muted">
                    {new Date(backup.createdAt).toLocaleDateString()} ·{" "}
                    {formatBytes(backup.fileSizeBytes)}
                  </p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => void handleDownload(backup.id)}>
                  Download
                </Button>
              </li>
            ))}
          </ul>
        )}
        {downloadError && (
          <div className="mt-3">
            <ErrorNote message={downloadError} />
          </div>
        )}
      </section>

      <section>
        <h2 className="font-semibold text-ink">2. Confirm deletion</h2>
        <p className="mt-2 text-sm text-muted">
          This action is <strong className="text-danger">immediate and irreversible</strong>. All
          backups will be destroyed.
        </p>
        <label htmlFor="confirm" className="mt-4 block text-sm font-medium text-ink">
          Type{" "}
          <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-xs">
            {CONFIRM_PHRASE}
          </code>{" "}
          to confirm
        </label>
        <Input
          id="confirm"
          type="text"
          value={confirmText}
          onChange={(event) => setConfirmText(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          className="mt-2 font-mono"
          placeholder={CONFIRM_PHRASE}
        />
        {error && (
          <div className="mt-3">
            <ErrorNote message={error} />
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            variant="danger"
            onClick={() => void handleDelete()}
            disabled={confirmText !== CONFIRM_PHRASE}
          >
            Permanently delete my account
          </Button>
          <Button variant="secondary" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      </section>
    </div>
  );
}