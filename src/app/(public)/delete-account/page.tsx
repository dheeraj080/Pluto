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
    <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Delete your account</h1>
      <DeleteAccountForm />
    </div>
  );
}
