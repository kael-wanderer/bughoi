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
      <div className="space-y-4 px-4 py-4">
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
        {loading ? <p className="text-sm text-slate-500">Loading profile...</p> : null}

        <MobileCard>
          <p className="text-sm font-semibold">Theme Color</p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
            {(["orange", "gray", "green"] as const).map((value) => (
              <button
                key={value}
                className={`rounded-lg px-2 py-2 ${theme === value ? "bg-primary font-semibold text-white" : "bg-slate-100"}`}
                onClick={() => chooseTheme(value)}
                type="button"
              >
                {value}
              </button>
            ))}
          </div>
        </MobileCard>

        <MobileCard>
          <p className="text-sm font-semibold">Account</p>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <p>Name: {me?.displayName ?? "-"}</p>
            <p>Email: {me?.email ?? "-"}</p>
            <p>Roles: {me?.roles.join(", ") ?? "-"}</p>
          </div>
          <label className="mt-3 block text-xs text-slate-600">Time Zone</label>
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
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
          <button className="mt-3 w-full rounded-lg bg-primary py-2 text-sm font-semibold text-white" onClick={savePreferences} type="button">
            Save Preferences
          </button>
          <button
            className="mt-2 w-full rounded-lg border border-slate-300 py-2 text-sm font-semibold text-slate-700"
            onClick={() => setShowPasswordForm((v) => !v)}
            type="button"
          >
            {showPasswordForm ? "Hide Change Password" : "Change Password"}
          </button>

          {showPasswordForm ? (
            <div className="mt-3 space-y-2">
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current password"
                type="password"
                value={currentPassword}
              />
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                onChange={(e) => setNextPassword(e.target.value)}
                placeholder="New password"
                type="password"
                value={nextPassword}
              />
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                type="password"
                value={confirmPassword}
              />
              <button className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-white" onClick={changeMyPassword} type="button">
                Update Password
              </button>
            </div>
          ) : null}
        </MobileCard>

        <MobileCard>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Notification Channels</p>
            <button className="text-xs font-semibold text-primary" onClick={() => setShowNotificationSection((v) => !v)} type="button">
              {showNotificationSection ? "Collapse" : "Expand"}
            </button>
          </div>
          {showNotificationSection ? <div className="mt-3 space-y-3">
            <div>
              <label className="text-xs text-slate-600">Email</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                onChange={(e) => setEmailAlerts(e.target.value)}
                placeholder="name@example.com"
                value={emailAlerts}
              />
              <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                <input checked={emailEnabled} onChange={(e) => setEmailEnabled(e.target.checked)} type="checkbox" />
                Enabled
              </label>
            </div>

            <div>
              <label className="text-xs text-slate-600">Telegram</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                onChange={(e) => setTelegramAlerts(e.target.value)}
                placeholder="@your_handle"
                value={telegramAlerts}
              />
              <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                <input checked={telegramEnabled} onChange={(e) => setTelegramEnabled(e.target.checked)} type="checkbox" />
                Enabled
              </label>
            </div>

            <button className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-white" onClick={saveChannels} type="button">
              Save Notification Channels
            </button>
          </div> : (
            <button className="mt-3 w-full rounded-lg border border-slate-200 py-2 text-sm font-semibold text-primary" onClick={() => setShowNotificationSection(true)} type="button">
              Open Notification Settings
            </button>
          )}
        </MobileCard>

        <MobileCard>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Two-Factor Authentication (2FA)</p>
            <button className="text-xs font-semibold text-primary" onClick={() => setShow2faSection((v) => !v)} type="button">
              {show2faSection ? "Collapse" : "Expand"}
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500">Optional: Use Authy to scan QR and protect login.</p>
          <p className="mt-1 text-xs font-semibold">{me?.twoFactorEnabled ? "Status: Enabled" : "Status: Disabled"}</p>

          {show2faSection ? (!me?.twoFactorEnabled ? (
            <div className="mt-3 space-y-2">
              <button className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-white" onClick={begin2faSetup} type="button">
                Enable 2FA
              </button>

              {setup2faUri ? (
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs text-slate-500">Scan this QR using Authy:</p>
                  <img
                    alt="2FA QR"
                    className="mt-2 h-48 w-48 rounded-md border border-slate-200"
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(setup2faUri)}`}
                  />
                  <p className="mt-2 break-all text-[11px] text-slate-500">Secret: {setup2faSecret}</p>
                  <input
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    onChange={(e) => setSetup2faOtp(e.target.value)}
                    placeholder="Enter 6-digit code from Authy"
                    value={setup2faOtp}
                  />
                  <button className="mt-2 w-full rounded-lg border border-primary py-2 text-sm font-semibold text-primary" onClick={confirm2faEnable} type="button">
                    Confirm Enable 2FA
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                onChange={(e) => setDisable2faOtp(e.target.value)}
                placeholder="Enter current 2FA code to disable"
                value={disable2faOtp}
              />
              <button className="w-full rounded-lg border border-rose-300 py-2 text-sm font-semibold text-rose-600" onClick={disable2fa} type="button">
                Disable 2FA
              </button>
            </div>
          )) : (
            <button className="mt-3 w-full rounded-lg border border-slate-200 py-2 text-sm font-semibold text-primary" onClick={() => setShow2faSection(true)} type="button">
              Open 2FA Settings
            </button>
          )}
        </MobileCard>

        {canManageUsers ? (
          <MobileCard>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Admin User Management</p>
              <button className="text-xs font-semibold text-primary" onClick={() => setShowAdminSection((v) => !v)} type="button">
                {showAdminSection ? "Collapse" : "Expand"}
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">Only visible for owner/admin roles.</p>

            {showAdminSection ? <div className="mt-3 space-y-3">
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Add User</p>
                <div className="mt-2 space-y-2">
                  <input
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="Display name"
                    value={newUserName}
                  />
                  <input
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="Email"
                    type="email"
                    value={newUserEmail}
                  />
                  <input
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="Temporary password (min 8 chars)"
                    type="password"
                    value={newUserPassword}
                  />
                  <select
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    onChange={(e) => setNewUserRole(e.target.value as "owner" | "admin" | "member")}
                    value={newUserRole}
                  >
                    <option value="member">user</option>
                    <option value="admin">admin</option>
                    <option value="owner">owner</option>
                  </select>
                  <button
                    className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-white disabled:opacity-60"
                    disabled={savingAdminUserId === "new"}
                    onClick={createUser}
                    type="button"
                  >
                    {savingAdminUserId === "new" ? "Adding..." : "Add User"}
                  </button>
                </div>
              </div>

              {loadingAdminUsers ? <p className="text-sm text-slate-500">Loading users...</p> : null}
              {!loadingAdminUsers && adminUsers.length === 0 ? <p className="text-sm text-slate-500">No users found.</p> : null}

              {adminUsers.map((user) => {
                const role = user.roles.includes("owner") ? "owner" : user.roles.includes("admin") ? "admin" : "member";
                return (
                  <div className="rounded-lg border border-slate-200 p-3" key={user.id}>
                    <p className="text-sm font-semibold">{user.displayName}</p>
                    <p className="mt-1 text-xs text-slate-500">{user.email}</p>
                    <p className="mt-1 text-xs text-slate-500">Timezone: {user.timezone}</p>
                    {user.isMasterOwner ? (
                      <p className="mt-1 text-xs font-semibold text-primary">Master Owner</p>
                    ) : null}

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <select
                        className="rounded-lg border border-slate-200 px-2 py-2 text-xs"
                        defaultValue={role}
                        disabled={savingAdminUserId === user.id || !!user.isMasterOwner}
                        onChange={(e) => saveRole(user.id, e.target.value as "owner" | "admin" | "member")}
                      >
                        <option value="owner">owner</option>
                        <option value="admin">admin</option>
                        <option value="member">user</option>
                      </select>

                      <select
                        className="rounded-lg border border-slate-200 px-2 py-2 text-xs"
                        defaultValue={String(user.active)}
                        disabled={savingAdminUserId === user.id || !!user.isMasterOwner}
                        onChange={(e) => saveStatus(user.id, e.target.value === "true")}
                      >
                        <option value="true">active</option>
                        <option value="false">inactive</option>
                      </select>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button
                        className="rounded-lg border border-amber-300 py-2 text-xs font-semibold text-amber-700 disabled:opacity-60"
                        disabled={savingAdminUserId === user.id || !user.active || !!user.isMasterOwner}
                        onClick={() => deactivateUser(user.id)}
                        type="button"
                      >
                        Deactivate
                      </button>
                      <button
                        className="rounded-lg border border-rose-300 py-2 text-xs font-semibold text-rose-600 disabled:opacity-60"
                        disabled={savingAdminUserId === user.id || !!user.isMasterOwner}
                        onClick={() => removeUser(user.id)}
                        type="button"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="mt-2 space-y-2">
                      <input
                        className="w-full rounded-lg border border-slate-200 px-2 py-2 text-xs"
                        onChange={(e) => setPasswordDrafts((prev) => ({ ...prev, [user.id]: e.target.value }))}
                        placeholder="Set new password (min 8 chars)"
                        type="password"
                        value={passwordDrafts[user.id] ?? ""}
                      />
                      <button
                        className="w-full rounded-lg border border-slate-300 py-2 text-xs font-semibold disabled:opacity-60"
                        disabled={savingAdminUserId === user.id}
                        onClick={() => resetUserPassword(user.id)}
                        type="button"
                      >
                        Reset Password
                      </button>
                    </div>
                  </div>
                );
              })}
            </div> : (
              <button className="mt-3 w-full rounded-lg border border-slate-200 py-2 text-sm font-semibold text-primary" onClick={() => setShowAdminSection(true)} type="button">
                Open Admin User Management
              </button>
            )}
          </MobileCard>
        ) : null}

        <button className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm font-semibold" onClick={logout} type="button">
          Logout
        </button>
      </div>
    </main>
  );
}
