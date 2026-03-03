"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "../../components/header";
import { MobileCard } from "../../components/mobile-card";
import { authedFetch, clearToken, getToken } from "../../lib/auth-client";

type Me = {
  id: string;
  email: string;
  displayName: string;
  timezone: string;
  theme: string;
  twoFactorEnabled?: boolean;
  roles: string[];
  channels?: Array<{
    id: string;
    type: "email" | "telegram" | string;
    enabled: boolean;
    value: string;
  }>;
};

const timezoneOptions = [
  "UTC",
  "Asia/Ho_Chi_Minh",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Dubai",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "Australia/Sydney"
] as const;

type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  isMasterOwner?: boolean;
  active: boolean;
  timezone: string;
  roles: string[];
};

export default function ProfilePage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [timezone, setTimezone] = useState("UTC");
  const [theme, setTheme] = useState<"orange" | "gray" | "green">("orange");
  const [emailAlerts, setEmailAlerts] = useState("");
  const [telegramAlerts, setTelegramAlerts] = useState("");
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [telegramEnabled, setTelegramEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingAdminUsers, setLoadingAdminUsers] = useState(false);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [passwordDrafts, setPasswordDrafts] = useState<Record<string, string>>({});
  const [savingAdminUserId, setSavingAdminUserId] = useState<string | null>(null);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<"owner" | "admin" | "member">("member");
  const [showAdminSection, setShowAdminSection] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showNotificationSection, setShowNotificationSection] = useState(false);
  const [show2faSection, setShow2faSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [setup2faUri, setSetup2faUri] = useState("");
  const [setup2faSecret, setSetup2faSecret] = useState("");
  const [setup2faOtp, setSetup2faOtp] = useState("");
  const [disable2faOtp, setDisable2faOtp] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      setError("not-auth");
      return;
    }

    setLoading(true);
    authedFetch<Me>("/me")
      .then((data) => {
        const savedTheme = data.theme === "gray" || data.theme === "green" ? data.theme : "orange";
        setMe(data);
        setTimezone(data.timezone);
        setTheme(savedTheme);
        document.documentElement.setAttribute("data-theme", savedTheme);
        window.localStorage.setItem("bug_theme", savedTheme);
        const emailChannel = data.channels?.find((c) => c.type === "email");
        const telegramChannel = data.channels?.find((c) => c.type === "telegram");
        setEmailAlerts(emailChannel?.value ?? "");
        setEmailEnabled(emailChannel?.enabled ?? true);
        setTelegramAlerts(telegramChannel?.value ?? "");
        setTelegramEnabled(telegramChannel?.enabled ?? true);
        if (data.roles.includes("owner") || data.roles.includes("admin")) {
          loadAdminUsers();
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load profile"))
      .finally(() => setLoading(false));
  }, []);

  function chooseTheme(nextTheme: "orange" | "gray" | "green") {
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    window.localStorage.setItem("bug_theme", nextTheme);
  }

  async function loadAdminUsers() {
    setLoadingAdminUsers(true);
    try {
      const data = await authedFetch<AdminUser[]>("/admin/users");
      setAdminUsers(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admin users");
    } finally {
      setLoadingAdminUsers(false);
    }
  }

  async function savePreferences() {
    try {
      const updated = await authedFetch<{ id: string; timezone: string; theme: "orange" | "gray" | "green" }>("/me/preferences", {
        method: "PATCH",
        body: JSON.stringify({ timezone, theme })
      });
      setTimezone(updated.timezone);
      setTheme(updated.theme);
      setMe((prev) => (prev ? { ...prev, timezone: updated.timezone, theme: updated.theme } : prev));
      document.documentElement.setAttribute("data-theme", updated.theme);
      window.localStorage.setItem("bug_theme", updated.theme);
      setSuccess("Preferences saved");
      window.alert("Preferences saved");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save preferences");
    }
  }

  async function saveChannels() {
    const channels = [
      ...(emailAlerts.trim()
        ? [{ type: "email", enabled: emailEnabled, value: emailAlerts.trim() }]
        : []),
      ...(telegramAlerts.trim()
        ? [{ type: "telegram", enabled: telegramEnabled, value: telegramAlerts.trim() }]
        : [])
    ];

    if (channels.length === 0) {
      setError("Add at least one email or telegram channel value");
      return;
    }

    try {
      await authedFetch("/me/notification-channels", {
        method: "PATCH",
        body: JSON.stringify({ channels })
      });
      setSuccess("Notification channels saved");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save notification channels");
    }
  }

  async function changeMyPassword() {
    if (nextPassword.length < 8) {
      window.alert("New password must be at least 8 characters");
      return;
    }
    if (nextPassword !== confirmPassword) {
      window.alert("Confirm password does not match");
      return;
    }

    try {
      await authedFetch("/me/password", {
        method: "PATCH",
        body: JSON.stringify({
          currentPassword,
          newPassword: nextPassword
        })
      });
      setCurrentPassword("");
      setNextPassword("");
      setConfirmPassword("");
      setShowPasswordForm(false);
      setSuccess("Password changed");
      window.alert("Password changed successfully");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to change password";
      setError(message);
      window.alert(message);
    }
  }

  async function begin2faSetup() {
    try {
      const data = await authedFetch<{ otpauthUri: string; secret: string }>("/me/2fa/setup", { method: "POST" });
      setSetup2faUri(data.otpauthUri);
      setSetup2faSecret(data.secret);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start 2FA setup";
      setError(message);
      window.alert(message);
    }
  }

  async function confirm2faEnable() {
    try {
      await authedFetch("/me/2fa/enable", {
        method: "POST",
        body: JSON.stringify({ otp: setup2faOtp })
      });
      setSuccess("2FA enabled");
      window.alert("2FA enabled successfully");
      setSetup2faOtp("");
      setSetup2faSecret("");
      setSetup2faUri("");
      const meData = await authedFetch<Me>("/me");
      setMe(meData);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to enable 2FA";
      setError(message);
      window.alert(message);
    }
  }

  async function disable2fa() {
    try {
      await authedFetch("/me/2fa/disable", {
        method: "POST",
        body: JSON.stringify({ otp: disable2faOtp })
      });
      setSuccess("2FA disabled");
      window.alert("2FA disabled successfully");
      setDisable2faOtp("");
      const meData = await authedFetch<Me>("/me");
      setMe(meData);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to disable 2FA";
      setError(message);
      window.alert(message);
    }
  }

  function logout() {
    clearToken();
    router.push("/login");
  }

  async function saveRole(userId: string, role: "owner" | "admin" | "member") {
    setSavingAdminUserId(userId);
    try {
      await authedFetch(`/admin/users/${userId}/roles`, {
        method: "PATCH",
        body: JSON.stringify({ roles: [role] })
      });
      setSuccess("User role updated");
      await loadAdminUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user role");
    } finally {
      setSavingAdminUserId(null);
    }
  }

  async function saveStatus(userId: string, active: boolean) {
    setSavingAdminUserId(userId);
    try {
      await authedFetch(`/admin/users/${userId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ active })
      });
      setSuccess("User status updated");
      await loadAdminUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user status");
    } finally {
      setSavingAdminUserId(null);
    }
  }

  async function createUser() {
    if (!newUserEmail.trim() || !newUserName.trim() || newUserPassword.length < 8) {
      setError("Please input valid email, name, and password (min 8 chars)");
      return;
    }

    setSavingAdminUserId("new");
    try {
      await authedFetch("/admin/users", {
        method: "POST",
        body: JSON.stringify({
          email: newUserEmail.trim(),
          displayName: newUserName.trim(),
          password: newUserPassword,
          roles: [newUserRole],
          active: true
        })
      });
      setSuccess("User added");
      window.alert("User added successfully");
      setNewUserEmail("");
      setNewUserName("");
      setNewUserPassword("");
      setNewUserRole("member");
      await loadAdminUsers();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add user";
      setError(message);
      window.alert(message);
    } finally {
      setSavingAdminUserId(null);
    }
  }

  async function deactivateUser(userId: string) {
    setSavingAdminUserId(userId);
    try {
      await authedFetch(`/admin/users/${userId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ active: false })
      });
      setSuccess("User deactivated");
      window.alert("User deactivated successfully");
      await loadAdminUsers();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to deactivate user";
      setError(message);
      window.alert(message);
    } finally {
      setSavingAdminUserId(null);
    }
  }

  async function removeUser(userId: string) {
    if (!window.confirm("Remove this user permanently?")) return;
    setSavingAdminUserId(userId);
    try {
      await authedFetch(`/admin/users/${userId}`, { method: "DELETE" });
      setSuccess("User removed");
      window.alert("User removed successfully");
      await loadAdminUsers();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to remove user";
      setError(message);
      window.alert(message);
    } finally {
      setSavingAdminUserId(null);
    }
  }

  async function resetUserPassword(userId: string) {
    const nextPassword = (passwordDrafts[userId] ?? "").trim();
    if (nextPassword.length < 8) {
      const message = "Password must be at least 8 characters";
      setError(message);
      window.alert(message);
      return;
    }

    setSavingAdminUserId(userId);
    try {
      await authedFetch(`/admin/users/${userId}/password`, {
        method: "PATCH",
        body: JSON.stringify({ password: nextPassword })
      });
      setSuccess("Password reset");
      window.alert("Password reset successfully");
      setPasswordDrafts((prev) => ({ ...prev, [userId]: "" }));
      await loadAdminUsers();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to reset password";
      setError(message);
      window.alert(message);
    } finally {
      setSavingAdminUserId(null);
    }
  }

  const canManageUsers = !!me && (me.roles.includes("owner") || me.roles.includes("admin"));

  return (
    <main>
      <Header title="Profile" />
      <div className="space-y-6 px-4 py-4 pb-28 md:grid md:grid-cols-12 md:gap-8 md:space-y-0 md:px-8 md:py-8 md:pb-8">
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
        {loading ? <div className="md:col-span-12"><p className="text-sm text-slate-500 animate-pulse">Fetching your profile engine...</p></div> : null}

        <div className="md:col-span-12 lg:col-span-5 space-y-6">
          <MobileCard>
            <div className="flex items-center gap-4 mb-6">
              <div className="h-16 w-16 rounded-3xl bg-primary/10 flex items-center justify-center text-primary text-2xl font-black shadow-inner">
                {me?.displayName?.[0]?.toUpperCase() ?? "U"}
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 leading-tight">{me?.displayName ?? "User Account"}</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{me?.roles.join(", ") ?? "Member"}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Email Address</p>
                <p className="text-sm font-bold text-slate-700">{me?.email ?? "-"}</p>
              </div>

              <div>
                <label className="mb-2 block text-[11px] font-black text-slate-400 uppercase tracking-widest">Time Zone</label>
                <select
                  className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white"
                  onChange={(e) => setTimezone(e.target.value)}
                  value={timezone}
                >
                  {!timezoneOptions.includes(timezone as (typeof timezoneOptions)[number]) ? (
                    <option value={timezone}>{timezone}</option>
                  ) : null}
                  {timezoneOptions.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2">
                <button className="w-full rounded-2xl bg-primary py-4 text-sm font-black text-white shadow-lg shadow-primary/20 transition-transform active:scale-95" onClick={savePreferences} type="button">
                  Save Account Updates
                </button>
              </div>
            </div>
          </MobileCard>

          <MobileCard>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4">Visual Theme</h3>
            <div className="grid grid-cols-3 gap-3">
              {(["orange", "gray", "green"] as const).map((value) => (
                <button
                  key={value}
                  className={`relative flex flex-col items-center gap-2 rounded-2xl p-4 transition-all ${theme === value
                      ? "bg-primary/5 ring-2 ring-primary shadow-sm"
                      : "bg-slate-50 ring-1 ring-slate-100 hover:bg-slate-100"
                    }`}
                  onClick={() => chooseTheme(value)}
                  type="button"
                >
                  <div className={`h-8 w-8 rounded-full border-2 border-white shadow-sm ${value === 'orange' ? 'bg-primary' : value === 'gray' ? 'bg-slate-500' : 'bg-emerald-500'
                    }`} />
                  <span className={`text-[10px] font-black uppercase tracking-widest ${theme === value ? "text-primary" : "text-slate-500"}`}>{value}</span>
                  {theme === value && <div className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-primary text-white rounded-full flex items-center justify-center shadow-md"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg></div>}
                </button>
              ))}
            </div>
          </MobileCard>

          <MobileCard>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Security</h3>
              <button
                className="text-xs font-black text-primary hover:underline uppercase tracking-widest"
                onClick={() => setShowPasswordForm((v) => !v)}
                type="button"
              >
                {showPasswordForm ? "Close" : "Change Password"}
              </button>
            </div>

            {showPasswordForm ? (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="space-y-3">
                  <input
                    className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white"
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Current password"
                    type="password"
                    value={currentPassword}
                  />
                  <input
                    className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white"
                    onChange={(e) => setNextPassword(e.target.value)}
                    placeholder="New password (8+ chars)"
                    type="password"
                    value={nextPassword}
                  />
                  <input
                    className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white"
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    type="password"
                    value={confirmPassword}
                  />
                </div>
                <button className="w-full rounded-2xl bg-slate-900 py-4 text-sm font-black text-white shadow-lg shadow-slate-900/10 transition-transform active:scale-95" onClick={changeMyPassword} type="button">
                  Confirm Password Change
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-400 font-medium">Manage your login credentials and authentication safety.</p>
            )}
          </MobileCard>

          <button className="w-full rounded-2xl border-2 border-slate-100 bg-white p-4 text-sm font-black text-rose-500 hover:bg-rose-50 hover:border-rose-100 hover:text-rose-600 transition-all active:scale-95" onClick={logout} type="button">
            Log Out Account
          </button>
        </div>

        <div className="md:col-span-12 lg:col-span-7 space-y-6">
          <MobileCard>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Notification Channels</h3>
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-sm">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    </div>
                    <span className="text-sm font-black text-slate-800">Email Alerts</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input checked={emailEnabled} onChange={(e) => setEmailEnabled(e.target.checked)} type="checkbox" className="sr-only peer" />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                  onChange={(e) => setEmailAlerts(e.target.value)}
                  placeholder="name@example.com"
                  value={emailAlerts}
                />
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center shadow-sm">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>
                    </div>
                    <span className="text-sm font-black text-slate-800">Telegram Bot</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input checked={telegramEnabled} onChange={(e) => setTelegramEnabled(e.target.checked)} type="checkbox" className="sr-only peer" />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                  onChange={(e) => setTelegramAlerts(e.target.value)}
                  placeholder="@your_telegram_handle"
                  value={telegramAlerts}
                />
              </div>

              <button className="w-full rounded-2xl bg-slate-900 py-4 text-sm font-black text-white shadow-lg shadow-slate-900/10 transition-transform active:scale-95" onClick={saveChannels} type="button">
                Update All Channels
              </button>
            </div>
          </MobileCard>

          <MobileCard>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Two-Factor Authentication</h3>
              <span className={`px-2 py-0.5 text-[9px] font-black rounded uppercase tracking-wider ${me?.twoFactorEnabled ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                {me?.twoFactorEnabled ? "Secure" : "Vulnerable"}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mb-6">Use Authy or Google Authenticator to protect your account with a secondary dynamic code.</p>

            {!me?.twoFactorEnabled ? (
              <div className="space-y-4">
                {setup2faUri ? (
                  <div className="rounded-3xl border border-slate-100 bg-slate-50 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-500">
                    <div className="flex flex-col items-center">
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">Scan QR with Authy</p>
                      <div className="p-4 bg-white rounded-3xl shadow-sm ring-1 ring-slate-100">
                        <img
                          alt="2FA QR"
                          className="h-44 w-44 rounded-xl"
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(setup2faUri)}`}
                        />
                      </div>
                      <p className="mt-4 break-all text-[10px] font-bold text-slate-400 bg-white px-3 py-1.5 rounded-full ring-1 ring-slate-100">Code: {setup2faSecret}</p>
                    </div>

                    <div className="pt-4 space-y-3">
                      <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">Verify Verification Code</label>
                      <input
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-center text-xl font-black tracking-[0.5em] outline-none focus:ring-2 focus:ring-primary/20"
                        onChange={(e) => setSetup2faOtp(e.target.value)}
                        placeholder="000000"
                        maxLength={6}
                        value={setup2faOtp}
                      />
                      <button className="w-full rounded-2xl bg-primary py-4 text-sm font-black text-white shadow-lg shadow-primary/20 transition-transform active:scale-95" onClick={confirm2faEnable} type="button">
                        Confirm & Enable Security
                      </button>
                    </div>
                  </div>
                ) : (
                  <button className="w-full rounded-2xl border-2 border-primary/20 bg-primary/5 py-4 text-sm font-black text-primary hover:bg-primary/10 transition-all active:scale-95" onClick={begin2faSetup} type="button">
                    Initialize 2FA Setup
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <p className="text-sm font-bold text-emerald-700">Shield Active: Your account is protected by 2FA.</p>
                </div>

                <div className="pt-2">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Disable 2FA</p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      className="flex-1 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white"
                      onChange={(e) => setDisable2faOtp(e.target.value)}
                      placeholder="Auth Code"
                      maxLength={6}
                      value={disable2faOtp}
                    />
                    <button className="px-6 rounded-2xl border border-rose-200 text-rose-500 text-xs font-black hover:bg-rose-50 transition-colors uppercase tracking-widest" onClick={disable2fa} type="button">
                      Disable
                    </button>
                  </div>
                </div>
              </div>
            )}
          </MobileCard>

          {canManageUsers && (
            <MobileCard>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Admin Mission Control</h3>
                <span className="px-2 py-0.5 bg-slate-900 text-white text-[9px] font-black rounded uppercase tracking-wider">Restricted</span>
              </div>

              <div className="space-y-6">
                <div className="rounded-3xl border border-slate-100 bg-slate-50 p-6 space-y-4">
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Provision New Operator</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                      onChange={(e) => setNewUserName(e.target.value)}
                      placeholder="Display Name"
                      value={newUserName}
                    />
                    <input
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      placeholder="Email Address"
                      type="email"
                      value={newUserEmail}
                    />
                    <input
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      placeholder="Temp Password (8+)"
                      type="password"
                      value={newUserPassword}
                    />
                    <select
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                      onChange={(e) => setNewUserRole(e.target.value as "owner" | "admin" | "member")}
                      value={newUserRole}
                    >
                      <option value="member">User</option>
                      <option value="admin">Admin</option>
                      <option value="owner">Owner</option>
                    </select>
                  </div>
                  <button
                    className="w-full rounded-2xl bg-slate-900 py-3 text-sm font-black text-white hover:bg-slate-800 transition-colors disabled:opacity-60"
                    disabled={savingAdminUserId === "new"}
                    onClick={createUser}
                    type="button"
                  >
                    {savingAdminUserId === "new" ? "Provisioning..." : "Create New Operator"}
                  </button>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">Registry of Operators ({adminUsers.length})</h4>
                  {loadingAdminUsers ? (
                    <p className="text-center py-8 text-xs font-bold text-slate-400 animate-pulse">Loading Registry...</p>
                  ) : adminUsers.length === 0 ? (
                    <p className="text-center py-8 text-xs font-bold text-slate-400">Registry Empty</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {adminUsers.map((user) => {
                        const role = user.roles.includes("owner") ? "owner" : user.roles.includes("admin") ? "admin" : "member";
                        return (
                          <div className="rounded-3xl border border-slate-100 bg-white p-5 space-y-4 ring-1 ring-slate-200/50 hover:shadow-md transition-shadow" key={user.id}>
                            <div className="flex items-start justify-between">
                              <div className="min-w-0">
                                <p className="text-sm font-black text-slate-900 truncate">{user.displayName}</p>
                                <p className="text-[11px] font-bold text-slate-400 truncate">{user.email}</p>
                              </div>
                              {user.isMasterOwner && <span className="px-2 py-0.5 bg-primary/10 text-primary text-[9px] font-black rounded uppercase">System Root</span>}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <p className="text-[9px] font-black text-slate-400 uppercase">Privilege Level</p>
                                <select
                                  className="w-full rounded-xl border border-slate-100 bg-slate-50 px-2 py-2 text-xs font-bold outline-none focus:ring-1 focus:ring-primary/20"
                                  defaultValue={role}
                                  disabled={savingAdminUserId === user.id || !!user.isMasterOwner}
                                  onChange={(e) => saveRole(user.id, e.target.value as "owner" | "admin" | "member")}
                                >
                                  <option value="owner">Owner</option>
                                  <option value="admin">Admin</option>
                                  <option value="member">User</option>
                                </select>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[9px] font-black text-slate-400 uppercase">Operator Status</p>
                                <select
                                  className="w-full rounded-xl border border-slate-100 bg-slate-50 px-2 py-2 text-xs font-bold outline-none focus:ring-1 focus:ring-primary/20 text-slate-700"
                                  defaultValue={String(user.active)}
                                  disabled={savingAdminUserId === user.id || !!user.isMasterOwner}
                                  onChange={(e) => saveStatus(user.id, e.target.value === "true")}
                                >
                                  <option value="true">Active</option>
                                  <option value="false">Inactive</option>
                                </select>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-slate-50 flex gap-2">
                              <button
                                className="flex-1 rounded-xl border border-slate-100 bg-slate-50 py-2.5 text-[10px] font-black text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                                disabled={savingAdminUserId === user.id || !!user.isMasterOwner}
                                onClick={() => {
                                  const pass = window.prompt("Enter new temporary password (min 8 chars):");
                                  if (pass) {
                                    setPasswordDrafts(p => ({ ...p, [user.id]: pass }));
                                    // Trigger reset manually for cleaner UI interaction
                                    setTimeout(() => resetUserPassword(user.id), 100);
                                  }
                                }}
                                type="button"
                              >
                                Reset Pass
                              </button>
                              <button
                                className="flex-0 px-4 rounded-xl border border-rose-100 bg-rose-50/30 py-2.5 text-[10px] font-black text-rose-500 hover:bg-rose-50 disabled:opacity-40"
                                disabled={savingAdminUserId === user.id || !!user.isMasterOwner}
                                onClick={() => removeUser(user.id)}
                                type="button"
                              >
                                Burn
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </MobileCard>
          )}
        </div>
      </div>
    </main>
  );
}
