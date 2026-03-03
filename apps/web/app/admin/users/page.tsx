"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Header } from "../../../components/header";
import { MobileCard } from "../../../components/mobile-card";
import { authedFetch, getToken } from "../../../lib/auth-client";

type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  active: boolean;
  timezone: string;
  roles: string[];
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await authedFetch<AdminUser[]>("/admin/users");
      setUsers(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!getToken()) {
      setError("not-auth");
      return;
    }
    loadUsers();
  }, []);

  async function saveRole(userId: string, role: "owner" | "admin" | "member") {
    setSavingUserId(userId);
    try {
      await authedFetch(`/admin/users/${userId}/roles`, {
        method: "PATCH",
        body: JSON.stringify({ roles: [role] })
      });
      setSuccess("Role updated");
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setSavingUserId(null);
    }
  }

  async function saveStatus(userId: string, active: boolean) {
    setSavingUserId(userId);
    try {
      await authedFetch(`/admin/users/${userId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ active })
      });
      setSuccess("Status updated");
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setSavingUserId(null);
    }
  }

  return (
    <main>
      <Header title="Admin Users" />
      <div className="space-y-3 px-4 py-4">
        {error === "not-auth" ? (
          <MobileCard>
            <p className="text-sm">You need to sign in first.</p>
            <Link className="mt-2 inline-block text-sm font-semibold text-primary" href="/login">
              Open Login
            </Link>
          </MobileCard>
        ) : null}

        {error && error !== "not-auth" ? <p className="text-sm text-red-600">{error}</p> : null}
        {success ? <p className="text-sm text-emerald-600">{success}</p> : null}
        {loading ? <p className="text-sm text-slate-500">Loading users...</p> : null}
        {!loading && users.length === 0 ? <p className="text-sm text-slate-500">No users found.</p> : null}

        {users.map((user) => {
          const role = user.roles.includes("owner") ? "owner" : user.roles.includes("admin") ? "admin" : "member";
          return (
            <MobileCard key={user.id}>
              <p className="text-sm font-semibold">{user.displayName}</p>
              <p className="mt-1 text-xs text-slate-500">{user.email}</p>
              <p className="mt-1 text-xs text-slate-500">Timezone: {user.timezone}</p>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <select
                  className="rounded-lg border border-slate-200 px-2 py-2 text-xs"
                  defaultValue={role}
                  disabled={savingUserId === user.id}
                  onChange={(e) => saveRole(user.id, e.target.value as "owner" | "admin" | "member")}
                >
                  <option value="owner">owner</option>
                  <option value="admin">admin</option>
                  <option value="member">member</option>
                </select>

                <select
                  className="rounded-lg border border-slate-200 px-2 py-2 text-xs"
                  defaultValue={String(user.active)}
                  disabled={savingUserId === user.id}
                  onChange={(e) => saveStatus(user.id, e.target.value === "true")}
                >
                  <option value="true">active</option>
                  <option value="false">inactive</option>
                </select>
              </div>
            </MobileCard>
          );
        })}
      </div>
    </main>
  );
}
