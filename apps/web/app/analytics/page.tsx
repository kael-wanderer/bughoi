"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Header } from "../../components/header";
import { MobileCard } from "../../components/mobile-card";
import { authedFetch, getToken } from "../../lib/auth-client";

type AnalyticsItem = "goal" | "task";
type ViewType = "chart" | "table" | "both";
type RangeType = "weekly" | "monthly" | "quarterly" | "custom";

type Goal = {
  id: string;
  title: string;
  periodType: "weekly" | "monthly" | "quarterly";
  periodStart: string;
  periodEnd: string;
  targetValue: number;
  unit: string;
  checkins: Array<{
    id: string;
    value: number;
    durationMins?: number | null;
    checkinDate: string;
  }>;
};

type Task = {
  id: string;
  title: string;
  status: "active" | "completed" | "overdue";
  dueAt: string | null;
  createdAt: string;
  completedAt?: string | null;
  priority: "low" | "medium" | "high";
  category?: string;
};

type Bucket = {
  label: string;
  value: number;
};

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function toInputDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function dayDiff(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

function buildBuckets(start: Date, end: Date, maxPoints = 12): Bucket[] {
  const days = Math.max(1, dayDiff(start, end) + 1);
  const step = Math.max(1, Math.ceil(days / maxPoints));
  const buckets: Bucket[] = [];
  for (let i = 0; i < days; i += step) {
    const begin = new Date(start);
    begin.setDate(begin.getDate() + i);
    const label = `${begin.getMonth() + 1}/${begin.getDate()}`;
    buckets.push({ label, value: 0 });
  }
  return buckets;
}

export default function AnalyticsPage() {
  const now = new Date();
  const defaultStart = new Date(now);
  defaultStart.setDate(defaultStart.getDate() - 6);

  const [item, setItem] = useState<AnalyticsItem>("goal");
  const [viewType, setViewType] = useState<ViewType>("both");
  const [rangeType, setRangeType] = useState<RangeType>("weekly");
  const [customStart, setCustomStart] = useState(toInputDate(defaultStart));
  const [customEnd, setCustomEnd] = useState(toInputDate(now));

  const [goals, setGoals] = useState<Goal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      setError("not-auth");
      return;
    }

    async function load() {
      setLoading(true);
      try {
        const [goalData, taskData] = await Promise.all([authedFetch<Goal[]>("/goals"), authedFetch<Task[]>("/tasks")]);
        setGoals(goalData);
        setTasks(taskData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load analytics");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const { rangeStart, rangeEnd } = useMemo(() => {
    const end = endOfDay(new Date());
    const start = startOfDay(new Date());
    if (rangeType === "weekly") {
      start.setDate(start.getDate() - 6);
      return { rangeStart: start, rangeEnd: end };
    }
    if (rangeType === "monthly") {
      start.setDate(start.getDate() - 29);
      return { rangeStart: start, rangeEnd: end };
    }
    if (rangeType === "quarterly") {
      start.setDate(start.getDate() - 89);
      return { rangeStart: start, rangeEnd: end };
    }
    const customStartDate = startOfDay(new Date(customStart));
    const customEndDate = endOfDay(new Date(customEnd));
    return {
      rangeStart: customStartDate,
      rangeEnd: customEndDate >= customStartDate ? customEndDate : customStartDate
    };
  }, [customEnd, customStart, rangeType]);

  const goalRows = useMemo(() => {
    return goals
      .filter((goal) => {
        const start = new Date(goal.periodStart);
        const end = new Date(goal.periodEnd);
        return end >= rangeStart && start <= rangeEnd;
      })
      .map((goal) => {
        const checkinCount = goal.checkins.length;
        const totalMins = goal.checkins.reduce((sum, c) => sum + (c.durationMins ?? 0), 0);
        const completionPct = goal.targetValue > 0 ? Math.min(100, (checkinCount / goal.targetValue) * 100) : 0;
        return {
          id: goal.id,
          title: goal.title,
          periodType: goal.periodType,
          targetValue: goal.targetValue,
          unit: goal.unit,
          checkinCount,
          totalMins,
          completionPct
        };
      });
  }, [goals, rangeEnd, rangeStart]);

  const taskRows = useMemo(() => {
    return tasks
      .filter((task) => {
        const pivot = new Date(task.completedAt || task.dueAt || task.createdAt);
        return pivot >= rangeStart && pivot <= rangeEnd;
      })
      .map((task) => ({
        ...task,
        completionPct: task.status === "completed" ? 100 : 0
      }));
  }, [rangeEnd, rangeStart, tasks]);

  const summary = useMemo(() => {
    if (item === "goal") {
      const total = goalRows.length;
      const avgCompletion = total > 0 ? goalRows.reduce((sum, g) => sum + g.completionPct, 0) / total : 0;
      const totalCheckins = goalRows.reduce((sum, g) => sum + g.checkinCount, 0);
      return {
        total,
        completion: avgCompletion,
        extra: totalCheckins,
        extraLabel: "Check-ins"
      };
    }

    const total = taskRows.length;
    const completed = taskRows.filter((t) => t.status === "completed").length;
    const completion = total > 0 ? (completed / total) * 100 : 0;
    return {
      total,
      completion,
      extra: completed,
      extraLabel: "Completed"
    };
  }, [goalRows, item, taskRows]);

  const chartData = useMemo(() => {
    const buckets = buildBuckets(rangeStart, rangeEnd);
    if (buckets.length === 0) return buckets;

    if (item === "goal") {
      for (const row of goalRows) {
        const g = goals.find((x) => x.id === row.id);
        if (!g) continue;
        for (const checkin of g.checkins) {
          const d = new Date(checkin.checkinDate);
          if (d < rangeStart || d > rangeEnd) continue;
          const idx = Math.min(
            buckets.length - 1,
            Math.floor((dayDiff(rangeStart, d) / Math.max(1, dayDiff(rangeStart, rangeEnd) + 1)) * buckets.length)
          );
          buckets[idx].value += 1;
        }
      }
      return buckets;
    }

    for (const task of taskRows) {
      if (task.status !== "completed") continue;
      const d = new Date(task.completedAt || task.dueAt || task.createdAt);
      const idx = Math.min(
        buckets.length - 1,
        Math.floor((dayDiff(rangeStart, d) / Math.max(1, dayDiff(rangeStart, rangeEnd) + 1)) * buckets.length)
      );
      buckets[idx].value += 1;
    }
    return buckets;
  }, [goalRows, goals, item, rangeEnd, rangeStart, taskRows]);

  const maxValue = Math.max(1, ...chartData.map((d) => d.value));

  return (
    <main>
      <Header title="Analytics" />
      <div className="space-y-4 px-4 py-4 pb-28">
        {error === "not-auth" ? (
          <MobileCard>
            <p className="text-sm">You need to sign in first.</p>
            <Link className="mt-2 inline-block text-sm font-semibold text-primary" href="/login">
              Open Login
            </Link>
          </MobileCard>
        ) : null}

        {error && error !== "not-auth" ? <p className="text-sm text-red-600">{error}</p> : null}
        {loading ? <p className="text-sm text-slate-500">Loading analytics...</p> : null}

        <MobileCard>
          <div className="space-y-3">
            <div>
              <p className="mb-1 text-xs text-slate-500">Select Item</p>
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 text-xs font-semibold">
                <button className={`rounded-lg py-2 ${item === "goal" ? "bg-primary text-white" : "text-slate-600"}`} onClick={() => setItem("goal")} type="button">
                  Goal
                </button>
                <button className={`rounded-lg py-2 ${item === "task" ? "bg-primary text-white" : "text-slate-600"}`} onClick={() => setItem("task")} type="button">
                  Task
                </button>
              </div>
            </div>

            <div>
              <p className="mb-1 text-xs text-slate-500">Select Type</p>
              <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-100 p-1 text-xs font-semibold">
                <button className={`rounded-lg py-2 ${viewType === "chart" ? "bg-primary text-white" : "text-slate-600"}`} onClick={() => setViewType("chart")} type="button">
                  Chart
                </button>
                <button className={`rounded-lg py-2 ${viewType === "table" ? "bg-primary text-white" : "text-slate-600"}`} onClick={() => setViewType("table")} type="button">
                  Table
                </button>
                <button className={`rounded-lg py-2 ${viewType === "both" ? "bg-primary text-white" : "text-slate-600"}`} onClick={() => setViewType("both")} type="button">
                  Both
                </button>
              </div>
            </div>

            <div>
              <p className="mb-1 text-xs text-slate-500">Time Range</p>
              <div className="grid grid-cols-4 gap-2 rounded-xl bg-slate-100 p-1 text-[11px] font-semibold">
                {(["weekly", "monthly", "quarterly", "custom"] as const).map((r) => (
                  <button
                    key={r}
                    className={`rounded-lg py-2 ${rangeType === r ? "bg-primary text-white" : "text-slate-600"}`}
                    onClick={() => setRangeType(r)}
                    type="button"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {rangeType === "custom" ? (
              <div className="grid grid-cols-2 gap-2">
                <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" onChange={(e) => setCustomStart(e.target.value)} type="date" value={customStart} />
                <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" onChange={(e) => setCustomEnd(e.target.value)} type="date" value={customEnd} />
              </div>
            ) : null}
          </div>
        </MobileCard>

        <MobileCard>
          <p className="text-xs text-slate-500">Summary</p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-slate-100 p-2">
              <p className="text-[11px] text-slate-500">Items</p>
              <p className="text-lg font-bold">{summary.total}</p>
            </div>
            <div className="rounded-lg bg-slate-100 p-2">
              <p className="text-[11px] text-slate-500">Completion</p>
              <p className="text-lg font-bold">{Math.round(summary.completion)}%</p>
            </div>
            <div className="rounded-lg bg-slate-100 p-2">
              <p className="text-[11px] text-slate-500">{summary.extraLabel}</p>
              <p className="text-lg font-bold">{summary.extra}</p>
            </div>
          </div>
        </MobileCard>

        {(viewType === "chart" || viewType === "both") && (
          <MobileCard>
            <p className="text-sm font-semibold">{item === "goal" ? "Goal Activity Chart" : "Task Completion Chart"}</p>
            <div className="mt-3 grid h-40 grid-cols-10 items-end gap-2">
              {chartData.map((point, i) => (
                <div key={`${point.label}-${i}`} className="flex flex-col items-center gap-1">
                  <div className="w-5 rounded-t bg-primary/80" style={{ height: `${(point.value / maxValue) * 100}%` }} />
                  <p className="text-[9px] text-slate-500">{point.label}</p>
                </div>
              ))}
            </div>
          </MobileCard>
        )}

        {(viewType === "table" || viewType === "both") && (
          <MobileCard>
            <p className="text-sm font-semibold">{item === "goal" ? "Goal Report Table" : "Task Report Table"}</p>
            <div className="mt-3 space-y-2">
              {item === "goal" ? (
                goalRows.length === 0 ? (
                  <p className="text-xs text-slate-500">No goals in selected range.</p>
                ) : (
                  goalRows.map((row) => (
                    <div className="rounded-lg border border-slate-200 p-3" key={row.id}>
                      <p className="text-sm font-semibold">{row.title}</p>
                      <p className="text-xs text-slate-500">
                        {row.periodType} | {row.checkinCount}/{row.targetValue} {row.unit}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">Total mins: {row.totalMins}</p>
                      <p className="mt-1 text-xs font-semibold text-primary">{Math.round(row.completionPct)}% complete</p>
                    </div>
                  ))
                )
              ) : taskRows.length === 0 ? (
                <p className="text-xs text-slate-500">No tasks in selected range.</p>
              ) : (
                taskRows.map((row) => (
                  <div className="rounded-lg border border-slate-200 p-3" key={row.id}>
                    <p className="text-sm font-semibold">{row.title}</p>
                    <p className="text-xs text-slate-500">
                      {row.category ?? "Task"} | {row.priority} | {row.status}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-primary">{row.status === "completed" ? "Completed" : "Pending"}</p>
                  </div>
                ))
              )}
            </div>
          </MobileCard>
        )}
      </div>
    </main>
  );
}
