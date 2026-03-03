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
      <div className="space-y-6 px-4 py-4 pb-28 md:grid md:grid-cols-12 md:gap-8 md:space-y-0 md:px-8 md:py-8 md:pb-8">
        {error === "not-auth" ? (
          <div className="md:col-span-12">
            <MobileCard>
              <p className="text-sm font-medium text-slate-800">You need to sign in first.</p>
              <Link className="mt-2 inline-block text-sm font-bold text-primary hover:underline" href="/login">
                Open Login
              </Link>
            </MobileCard>
          </div>
        ) : null}

        {error && error !== "not-auth" ? <div className="md:col-span-12"><p className="text-sm font-bold text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-100">{error}</p></div> : null}
        {loading ? <div className="md:col-span-12"><p className="text-sm text-slate-500 animate-pulse">Loading analytics engine...</p></div> : null}

        <div className="md:col-span-5 lg:col-span-4 space-y-6">
          <div className="sticky top-8 space-y-6">
            <MobileCard>
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Analytics Filters</h3>

                <div>
                  <p className="mb-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Select Item</p>
                  <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold ring-1 ring-slate-200/50">
                    <button className={`flex-1 rounded-lg py-2.5 transition-all ${item === "goal" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"}`} onClick={() => setItem("goal")} type="button">
                      Goals
                    </button>
                    <button className={`flex-1 rounded-lg py-2.5 transition-all ${item === "task" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"}`} onClick={() => setItem("task")} type="button">
                      Tasks
                    </button>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Display View</p>
                  <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold ring-1 ring-slate-200/50">
                    <button className={`flex-1 rounded-lg py-2.5 transition-all ${viewType === "chart" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"}`} onClick={() => setViewType("chart")} type="button">
                      Chart
                    </button>
                    <button className={`flex-1 rounded-lg py-2.5 transition-all ${viewType === "table" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"}`} onClick={() => setViewType("table")} type="button">
                      Table
                    </button>
                    <button className={`flex-1 rounded-lg py-2.5 transition-all ${viewType === "both" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"}`} onClick={() => setViewType("both")} type="button">
                      Both
                    </button>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Time Range</p>
                  <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 text-[11px] font-bold ring-1 ring-slate-200/50">
                    {(["weekly", "monthly", "quarterly", "custom"] as const).map((r) => (
                      <button
                        key={r}
                        className={`rounded-lg py-2.5 transition-all capitalize ${rangeType === r ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                        onClick={() => setRangeType(r)}
                        type="button"
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {rangeType === "custom" ? (
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <div>
                      <label className="mb-1 block text-[10px] font-bold text-slate-400 uppercase">Start</label>
                      <input className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white" onChange={(e) => setCustomStart(e.target.value)} type="date" value={customStart} />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-bold text-slate-400 uppercase">End</label>
                      <input className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white" onChange={(e) => setCustomEnd(e.target.value)} type="date" value={customEnd} />
                    </div>
                  </div>
                ) : null}
              </div>
            </MobileCard>

            <MobileCard>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">Performance Summary</h3>
              <div className="grid grid-cols-1 gap-4">
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total {item}s</p>
                    <p className="text-2xl font-black text-slate-900">{summary.total}</p>
                  </div>
                  <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Completion</p>
                    <p className="text-2xl font-black text-emerald-600">{Math.round(summary.completion)}%</p>
                  </div>
                  <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{summary.extraLabel}</p>
                    <p className="text-2xl font-black text-blue-600">{summary.extra}</p>
                  </div>
                  <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                </div>
              </div>
            </MobileCard>
          </div>
        </div>

        <div className="md:col-span-7 lg:col-span-8 space-y-6">
          {(viewType === "chart" || viewType === "both") && (
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm ring-1 ring-slate-200/50">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-lg font-black text-slate-800 tracking-tight">{item === "goal" ? "Goal Activity Frequency" : "Task Completion Trends"}</h3>
                <span className="px-3 py-1 bg-slate-100 text-[10px] font-bold text-slate-500 rounded-full uppercase tracking-widest">Live Engine</span>
              </div>
              <div className="flex h-56 items-end justify-between gap-1 overflow-x-auto pb-4 px-2">
                {chartData.map((point, i) => (
                  <div key={`${point.label}-${i}`} className="flex flex-1 flex-col items-center gap-2 min-w-[32px] group">
                    <div className="relative w-full flex items-end justify-center h-full">
                      <div className="absolute -top-6 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-lg pointer-events-none z-10">
                        {point.value}
                      </div>
                      <div
                        className="w-full max-w-[20px] rounded-full bg-gradient-to-t from-primary to-primary/60 transition-all duration-500 group-hover:to-primary/40 group-hover:shadow-lg group-hover:shadow-primary/20"
                        style={{ height: `${(point.value / maxValue) * 100}%` }}
                      />
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 group-hover:text-primary transition-colors">{point.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(viewType === "table" || viewType === "both") && (
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm ring-1 ring-slate-200/50">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black text-slate-800 tracking-tight">{item === "goal" ? "Detailed Goal Analytics" : "Detailed Task Analytics"}</h3>
              </div>
              <div className="space-y-4">
                {item === "goal" ? (
                  goalRows.length === 0 ? (
                    <div className="py-12 text-center rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200">
                      <p className="text-sm font-bold text-slate-400">No goal data found for the current range.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      {goalRows.map((row) => (
                        <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition-all hover:bg-white hover:shadow-md hover:ring-1 hover:ring-slate-200/60" key={row.id}>
                          <p className="text-sm font-black text-slate-800 mb-1">{row.title}</p>
                          <div className="flex items-center gap-2 mb-3">
                            <span className="px-2 py-0.5 bg-slate-200 text-[9px] font-black text-slate-600 rounded uppercase tracking-wider">{row.periodType}</span>
                            <span className="text-[11px] font-bold text-slate-500">{row.checkinCount} / {row.targetValue} {row.unit}</span>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-[11px] font-bold">
                              <span className="text-slate-400">Progress</span>
                              <span className="text-primary">{Math.round(row.completionPct)}%</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                              <div className="h-full bg-primary transition-all duration-700" style={{ width: `${row.completionPct}%` }} />
                            </div>
                            <p className="text-[10px] font-bold text-slate-400 text-right">Total: {row.totalMins} mins</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : taskRows.length === 0 ? (
                  <div className="py-12 text-center rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200">
                    <p className="text-sm font-bold text-slate-400">No task activity recorded in this period.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {taskRows.map((row) => (
                      <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition-all hover:bg-white hover:shadow-md hover:ring-1 hover:ring-slate-200/60 flex items-start justify-between gap-4" key={row.id}>
                        <div className="min-w-0">
                          <p className="text-sm font-black text-slate-800 mb-1 truncate">{row.title}</p>
                          <div className="flex flex-wrap gap-2">
                            <span className="px-2 py-0.5 bg-slate-200 text-[9px] font-black text-slate-600 rounded uppercase tracking-wider">{row.category ?? "General"}</span>
                            <span className={`px-2 py-0.5 text-[9px] font-black rounded uppercase tracking-wider ${row.priority === 'high' ? 'bg-rose-100 text-rose-600' :
                                row.priority === 'medium' ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-600'
                              }`}>{row.priority}</span>
                          </div>
                        </div>
                        <div className="shrink-0">
                          {row.status === "completed" ? (
                            <span className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg flex"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg></span>
                          ) : (
                            <span className="p-1.5 bg-slate-200 text-slate-400 rounded-lg flex"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
