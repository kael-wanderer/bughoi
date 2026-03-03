"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Header } from "../../components/header";
import { authedFetch, getToken } from "../../lib/auth-client";

type Goal = {
  id: string;
  title: string;
  category: string;
  targetValue: number;
  unit: string;
  checkins: Array<{ value: number; durationMins?: number | null }>;
};

type Period = "weekly" | "monthly" | "quarterly";

function startEndByPeriod(period: Period): { start: Date; end: Date } {
  const now = new Date();

  if (period === "weekly") {
    const day = now.getDay();
    const offset = day === 0 ? -6 : 1 - day;
    const start = new Date(now);
    start.setDate(now.getDate() + offset);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (period === "monthly") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }

  const quarter = Math.floor(now.getMonth() / 3);
  const start = new Date(now.getFullYear(), quarter * 3, 1);
  const end = new Date(now.getFullYear(), quarter * 3 + 3, 0, 23, 59, 59, 999);
  return { start, end };
}

const iconStyles = [
  "bg-primary/10 text-primary",
  "bg-blue-500/10 text-blue-500",
  "bg-emerald-500/10 text-emerald-500"
];

export default function GoalsPage() {
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [periodParam, setPeriodParam] = useState<string | null>(null);
  const pageSize = 3;
  const [period, setPeriod] = useState<Period>("weekly");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<"name" | "progress">("progress");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [showGoalForm, setShowGoalForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Personal");
  const [targetValue, setTargetValue] = useState("1");
  const [unit, setUnit] = useState("times");

  const [checkinGoalId, setCheckinGoalId] = useState("");
  const [checkinDate, setCheckinDate] = useState(new Date().toISOString().slice(0, 10));
  const [checkinMins, setCheckinMins] = useState("");
  const [checkinNote, setCheckinNote] = useState("");
  const [showQuickCheckin, setShowQuickCheckin] = useState(false);

  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!success) {
      return;
    }
    const t = window.setTimeout(() => setSuccess(null), 2500);
    return () => window.clearTimeout(t);
  }, [success]);

  const titleError = title.trim().length === 0 ? "Title is required" : null;
  const targetNumber = Number(targetValue);
  const targetError = Number.isNaN(targetNumber) || targetNumber <= 0 ? "Target must be greater than 0" : null;
  const checkinMinsNum = Number(checkinMins);
  const checkinError = Number.isNaN(checkinMinsNum) || checkinMinsNum <= 0 ? "Mins must be greater than 0" : null;
  const today = new Date();
  const maxCheckinDate = today.toISOString().slice(0, 10);
  const minDateObj = new Date(today);
  minDateObj.setDate(minDateObj.getDate() - 60);
  const minCheckinDate = minDateObj.toISOString().slice(0, 10);

  async function loadGoals(nextPeriod: Period) {
    setLoading(true);
    try {
      const data = await authedFetch<Goal[]>(`/goals?period=${nextPeriod}`);
      setGoals(data);
      if (!checkinGoalId && data.length > 0) {
        setCheckinGoalId(data[0].id);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load goals");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSelectedGoalId(params.get("goalId"));
    setPeriodParam(params.get("period"));
  }, []);

  useEffect(() => {
    if (!getToken()) {
      setError("not-auth");
      return;
    }
    loadGoals(period);
  }, [period]);

  useEffect(() => {
    if (periodParam === "weekly" || periodParam === "monthly" || periodParam === "quarterly") {
      setPeriod(periodParam);
    }
  }, [periodParam]);

  useEffect(() => {
    setPage(1);
  }, [goals, period, sortBy, sortOrder]);

  useEffect(() => {
    if (!selectedGoalId) {
      return;
    }
    const sorted = [...goals].sort((a, b) => {
      const progressA = a.targetValue > 0 ? a.checkins.length / a.targetValue : 0;
      const progressB = b.targetValue > 0 ? b.checkins.length / b.targetValue : 0;

      if (sortBy === "name") {
        const cmp = a.title.localeCompare(b.title);
        return sortOrder === "asc" ? cmp : -cmp;
      }

      const cmp = progressA - progressB;
      return sortOrder === "asc" ? cmp : -cmp;
    });
    const idx = sorted.findIndex((g) => g.id === selectedGoalId);
    if (idx >= 0) {
      setPage(Math.floor(idx / pageSize) + 1);
    }
  }, [goals, selectedGoalId, sortBy, sortOrder]);

  async function createGoal(event: FormEvent) {
    event.preventDefault();
    const { start, end } = startEndByPeriod(period);

    setBusy(true);
    try {
      await authedFetch("/goals", {
        method: "POST",
        body: JSON.stringify({
          title,
          category,
          periodType: period,
          periodStart: start.toISOString(),
          periodEnd: end.toISOString(),
          targetValue: Number(targetValue),
          unit
        })
      });
      setSuccess("Goal created");
      setTitle("");
      setShowGoalForm(false);
      await loadGoals(period);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create goal");
    } finally {
      setBusy(false);
    }
  }

  async function saveGoal(goalId: string) {
    setBusy(true);
    try {
      await authedFetch(`/goals/${goalId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title,
          category,
          targetValue: Number(targetValue),
          unit
        })
      });
      setEditingId(null);
      setShowGoalForm(false);
      setSuccess("Goal updated");
      await loadGoals(period);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update goal");
    } finally {
      setBusy(false);
    }
  }

  async function removeGoal(goalId: string) {
    if (!window.confirm("Delete this goal?")) {
      return;
    }
    setBusy(true);
    try {
      await authedFetch(`/goals/${goalId}`, { method: "DELETE" });
      setSuccess("Goal deleted");
      await loadGoals(period);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete goal");
    } finally {
      setBusy(false);
    }
  }

  function beginEdit(goal: Goal) {
    setEditingId(goal.id);
    setTitle(goal.title);
    setCategory(goal.category);
    setTargetValue(String(goal.targetValue));
    setUnit(goal.unit);
    setShowGoalForm(true);
  }

  async function submitCheckin(event: FormEvent) {
    event.preventDefault();
    if (!checkinGoalId) {
      setError("Please select a goal for check-in");
      return;
    }
    if (checkinError) {
      setError(checkinError);
      return;
    }
    if (checkinDate < minCheckinDate || checkinDate > maxCheckinDate) {
      setError("Check-in date must be within last 60 days and not in the future");
      return;
    }

    setBusy(true);
    try {
      await authedFetch(`/goals/${checkinGoalId}/checkins`, {
        method: "POST",
        body: JSON.stringify({
          durationMins: checkinMinsNum,
          note: checkinNote.trim() || undefined,
          checkinDate: new Date(`${checkinDate}T00:00:00`).toISOString()
        })
      });
      setSuccess("Check-in logged");
      setCheckinMins("");
      setCheckinNote("");
      await loadGoals(period);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log check-in");
    } finally {
      setBusy(false);
    }
  }

  const sortedGoals = useMemo(() => {
    return [...goals].sort((a, b) => {
      const progressA = a.targetValue > 0 ? a.checkins.length / a.targetValue : 0;
      const progressB = b.targetValue > 0 ? b.checkins.length / b.targetValue : 0;

      if (sortBy === "name") {
        const cmp = a.title.localeCompare(b.title);
        return sortOrder === "asc" ? cmp : -cmp;
      }

      const cmp = progressA - progressB;
      return sortOrder === "asc" ? cmp : -cmp;
    });
  }, [goals, sortBy, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(sortedGoals.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedGoals = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sortedGoals.slice(start, start + pageSize);
  }, [safePage, sortedGoals]);

  return (
    <main>
      <Header title="My Goals" />
      <div className="space-y-5 px-4 py-4 pb-32">
        {error === "not-auth" ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm">You need to sign in first.</p>
            <Link className="mt-2 inline-block text-sm font-semibold text-primary" href="/login">
              Open Login
            </Link>
          </div>
        ) : null}

        <div className="grid h-12 grid-cols-3 rounded-xl bg-slate-200/60 p-1 text-sm font-semibold">
          <button
            className={`rounded-lg ${period === "weekly" ? "bg-white text-primary shadow-sm" : "text-slate-500"}`}
            onClick={() => setPeriod("weekly")}
            type="button"
          >
            Weekly
          </button>
          <button
            className={`rounded-lg ${period === "monthly" ? "bg-white text-primary shadow-sm" : "text-slate-500"}`}
            onClick={() => setPeriod("monthly")}
            type="button"
          >
            Monthly
          </button>
          <button
            className={`rounded-lg ${period === "quarterly" ? "bg-white text-primary shadow-sm" : "text-slate-500"}`}
            onClick={() => setPeriod("quarterly")}
            type="button"
          >
            Quarterly
          </button>
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">{period[0].toUpperCase() + period.slice(1)} Progress</h2>
            <button className="text-sm font-bold text-primary" disabled={busy} onClick={() => setShowGoalForm((v) => !v)} type="button">
              {showGoalForm ? "Close" : "Add New"}
            </button>
          </div>

          {showGoalForm ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <form className="space-y-3" onSubmit={createGoal}>
                <input
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Goal title"
                  value={title}
                  disabled={busy}
                />
                {titleError ? <p className="text-xs text-rose-600">{titleError}</p> : null}
                <input
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Category"
                  value={category}
                  disabled={busy}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                    onChange={(e) => setTargetValue(e.target.value)}
                    placeholder="Target"
                    type="number"
                    value={targetValue}
                    disabled={busy}
                  />
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="Unit"
                    value={unit}
                    disabled={busy}
                  />
                </div>
                {targetError ? <p className="text-xs text-rose-600">{targetError}</p> : null}

                {editingId ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button className="rounded-xl bg-primary py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={busy || !!titleError || !!targetError} onClick={() => saveGoal(editingId)} type="button">
                      {busy ? "Saving..." : "Save Goal"}
                    </button>
                    <button
                      className="rounded-xl border border-slate-300 py-2 text-sm disabled:opacity-60"
                      disabled={busy}
                      onClick={() => {
                        setEditingId(null);
                        setShowGoalForm(false);
                      }}
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-white disabled:opacity-60" disabled={busy || !!titleError || !!targetError} type="submit">
                    {busy ? "Creating..." : "Create Goal"}
                  </button>
                )}
              </form>
            </div>
          ) : null}

          {loading ? <p className="text-sm text-slate-500">Loading goals...</p> : null}
          {success ? <p className="text-sm text-emerald-600">{success}</p> : null}
          {error && error !== "not-auth" ? <p className="text-sm text-rose-600">{error}</p> : null}
          {!loading && goals.length === 0 ? <p className="text-sm text-slate-500">No goals yet. Add your first goal.</p> : null}
          {goals.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                disabled={busy}
                onChange={(e) => setSortBy(e.target.value as "name" | "progress")}
                value={sortBy}
              >
                <option value="progress">Sort by progress</option>
                <option value="name">Sort by name</option>
              </select>
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                disabled={busy}
                onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
                value={sortOrder}
              >
                <option value="asc">ASC</option>
                <option value="desc">DESC</option>
              </select>
            </div>
          ) : null}

          {pagedGoals.map((goal, idx) => {
            const completedCount = goal.checkins.length;
            const totalMins = goal.checkins.reduce((sum, c) => sum + (c.durationMins ?? 0), 0);
            const progress = goal.targetValue > 0 ? Math.min(100, (completedCount / goal.targetValue) * 100) : 0;
            return (
              <div className={`rounded-xl border bg-white p-4 shadow-sm ${selectedGoalId === goal.id ? "border-primary" : "border-slate-200"}`} key={goal.id}>
                <div className="flex items-start gap-3">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconStyles[idx % iconStyles.length]}`}>
                    <span className="text-base font-bold">{goal.title[0]?.toUpperCase() ?? "G"}</span>
                  </div>
                  <div className="flex-1">
                    <div className="mb-1 flex items-start justify-between">
                      <h3 className="font-bold text-slate-900">{goal.title}</h3>
                      <span className="text-xs font-bold text-slate-400">{progress.toFixed(0)}%</span>
                    </div>
                    <p className="mb-2 text-sm text-slate-500">
                      {completedCount} of {goal.targetValue} {goal.unit}
                    </p>
                    <p className="mb-2 text-xs text-slate-400">Total logged: {totalMins} mins</p>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button className="rounded-lg border border-slate-300 py-2 text-xs font-semibold disabled:opacity-60" disabled={busy} onClick={() => beginEdit(goal)} type="button">
                    Edit
                  </button>
                  <button className="rounded-lg border border-rose-300 py-2 text-xs font-semibold text-rose-600 disabled:opacity-60" disabled={busy} onClick={() => removeGoal(goal.id)} type="button">
                    Delete
                  </button>
                </div>
              </div>
            );
          })}

          {sortedGoals.length > pageSize ? (
            <div className="flex items-center justify-center gap-2">
              <button
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs disabled:opacity-50"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                type="button"
              >
                Prev
              </button>
              {Array.from({ length: totalPages }).map((_, i) => {
                const value = i + 1;
                return (
                  <button
                    key={value}
                    className={`rounded-lg px-3 py-1.5 text-xs ${safePage === value ? "bg-primary text-white" : "border border-slate-200 bg-white"}`}
                    onClick={() => setPage(value)}
                    type="button"
                  >
                    {value}
                  </button>
                );
              })}
              <button
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs disabled:opacity-50"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                type="button"
              >
                Next
              </button>
            </div>
          ) : null}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Quick Check-in</h2>
            <button className="text-sm font-bold text-primary" onClick={() => setShowQuickCheckin((v) => !v)} type="button">
              {showQuickCheckin ? "Collapse" : "Open"}
            </button>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            {!showQuickCheckin ? (
              <button
                className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-white disabled:opacity-60"
                disabled={busy || goals.length === 0}
                onClick={() => setShowQuickCheckin(true)}
                type="button"
              >
                Log Activity
              </button>
            ) : <form className="space-y-4" onSubmit={submitCheckin}>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-600">Select Goal</label>
                <select
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                  disabled={busy || goals.length === 0}
                  value={checkinGoalId}
                  onChange={(e) => setCheckinGoalId(e.target.value)}
                >
                  {goals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-600">Date</label>
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                    type="date"
                    disabled={busy}
                    value={checkinDate}
                    min={minCheckinDate}
                    max={maxCheckinDate}
                    onChange={(e) => setCheckinDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-600">Mins</label>
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                    type="number"
                    placeholder="e.g. 60"
                    disabled={busy}
                    value={checkinMins}
                    onChange={(e) => setCheckinMins(e.target.value)}
                  />
                </div>
              </div>
              {checkinError && checkinMins ? <p className="text-xs text-rose-600">{checkinError}</p> : null}

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-600">Notes</label>
                <textarea
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Optional notes"
                  disabled={busy}
                  value={checkinNote}
                  onChange={(e) => setCheckinNote(e.target.value)}
                />
              </div>

              <button className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-white disabled:opacity-60" disabled={busy || !checkinGoalId || !!checkinError} type="submit">
                {busy ? "Saving..." : "Log Activity"}
              </button>
            </form>}
          </div>
        </section>
      </div>
    </main>
  );
}
