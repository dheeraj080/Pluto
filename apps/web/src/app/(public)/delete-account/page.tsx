import type { Metadata } from "next";
import { DeleteAccountForm } from "./delete-account-form";

export const metadata: Metadata = {
  title: "Delete your account",
  description:
    "Permanently delete your Pluto account, cloud backups, and sessions. Export your backups first if you need a copy.",
  robots: { index: false, follow: true },
};

export default function DeleteAccountPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Delete your account</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        This permanently removes your Pluto account and everything in it.
      </p>
      <DeleteAccountForm />
    </div>
  );
}