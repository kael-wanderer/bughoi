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
      <div className="space-y-6 px-4 py-4 pb-28 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-6 md:space-y-0 md:px-8 md:py-8 md:pb-8">
        {error === "not-auth" ? (
          <div className="md:col-span-12">
            <MobileCard>
              <div className="p-4 text-center">
                <p className="text-sm font-medium text-slate-800">You need to sign in first.</p>
                <Link className="mt-4 inline-block px-6 py-2 bg-primary text-white text-sm font-bold rounded-xl shadow-lg shadow-primary/20" href="/login">
                  Go to Login
                </Link>
              </div>
            </MobileCard>
          </div>
        ) : null}

        {error && error !== "not-auth" ? <div className="md:col-span-12"><p className="text-sm font-bold text-rose-600 bg-rose-50 p-4 rounded-2xl border border-rose-100">{error}</p></div> : null}
        {success ? <div className="md:col-span-12"><p className="text-sm font-bold text-emerald-600 bg-emerald-50 p-4 rounded-2xl border border-emerald-100">{success}</p></div> : null}
        {loading ? <div className="md:col-span-12"><p className="text-sm text-slate-500 animate-pulse">Scanning user database...</p></div> : null}
        {!loading && users.length === 0 ? <div className="md:col-span-12"><p className="text-sm text-slate-500 bg-slate-50 p-8 rounded-3xl text-center border-2 border-dashed border-slate-200">No users identified in the system.</p></div> : null}

        {users.map((user) => {
          const role = user.roles.includes("owner") ? "owner" : user.roles.includes("admin") ? "admin" : "member";
          return (
            <MobileCard key={user.id}>
              <div className="flex items-start justify-between mb-4">
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-slate-900 truncate tracking-tight">{user.displayName}</h3>
                  <p className="text-[11px] font-bold text-slate-400 truncate mt-0.5">{user.email}</p>
                </div>
                <div className={`h-2.5 w-2.5 rounded-full ${user.active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500'}`} title={user.active ? 'Active' : 'Inactive'} />
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Timezone</p>
                  <p className="text-xs font-bold text-slate-600 truncate">{user.timezone}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Role</p>
                    <select
                      className="w-full rounded-xl border border-slate-100 bg-white px-2 py-2 text-[11px] font-black outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
                      defaultValue={role}
                      disabled={savingUserId === user.id}
                      onChange={(e) => saveRole(user.id, e.target.value as "owner" | "admin" | "member")}
                    >
                      <option value="owner">Owner</option>
                      <option value="admin">Admin</option>
                      <option value="member">User</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Status</p>
                    <select
                      className="w-full rounded-xl border border-slate-100 bg-white px-2 py-2 text-[11px] font-black outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
                      defaultValue={String(user.active)}
                      disabled={savingUserId === user.id}
                      onChange={(e) => saveStatus(user.id, e.target.value === "true")}
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>
                </div>
              </div>

              {savingUserId === user.id && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center rounded-3xl animate-in fade-in duration-200">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"></div>
                  </div>
                </div>
              )}
            </MobileCard>
          );
        })}
      </div>
    </main>
  );
}
