"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { AdminUserSummary, Paginated } from "@/lib/types";
import {
  Badge,
  ErrorNote,
  LoadingNote,
  PageHeader,
  Pagination,
  Table,
} from "@/components/admin/ui";

const LIMIT = 20;

export default function AdminUsersPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<AdminUserSummary> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (search) params.set("search", search);
      const res = await api.get<Paginated<AdminUserSummary>>(`/admin/users?${params}`);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Users" description="All registered accounts with backup and session counts." />

      <form onSubmit={submitSearch} className="flex max-w-md gap-2">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search e-mail or name…"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-background"
        >
          Search
        </button>
      </form>

      {error && <ErrorNote message={error} />}
      {loading && !data && <LoadingNote label="Loading users…" />}

      {data && (
        <>
          <Table headers={["E-mail", "Name", "Role", "Backups", "Sessions", "Joined"]}>
            {data.items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted">
                  No users found.
                </td>
              </tr>
            )}
            {data.items.map((user) => (
              <tr key={user.id} className="hover:bg-background/60">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/users/${user.id}`}
                    className="font-medium text-accent underline-offset-2 hover:underline"
                  >
                    {user.email}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted">{user.name ?? "—"}</td>
                <td className="px-4 py-3">
                  <Badge tone={user.role === "ADMIN" ? "accent" : "neutral"}>{user.role}</Badge>
                </td>
                <td className="px-4 py-3 font-mono">{user.backupCount}</td>
                <td className="px-4 py-3 font-mono">{user.activeSessionCount}</td>
                <td className="px-4 py-3 text-muted">{formatDate(user.createdAt)}</td>
              </tr>
            ))}
          </Table>
          <Pagination page={data.page} total={data.total} limit={data.limit} onPage={setPage} />
        </>
      )}
    </div>
  );
}
