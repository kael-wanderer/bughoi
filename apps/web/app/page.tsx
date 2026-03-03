"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Header } from "../components/header";
import { MobileCard } from "../components/mobile-card";
import { authedFetch, getToken } from "../lib/auth-client";

type GoalItem = {
  goalId: string;
  title: string;
  completedCount: number;
  targetValue: number;
  unit: string;
  progress: number;
};

type Summary = {
  tasks: {
    active: number;
    completed: number;
    overdue: number;
    byPeriod: {
      weekly: {
        count: number;
        completedCount: number;
        completion: number;
        items: Array<{
          taskId: string;
          title: string;
          status: string;
          priority: string;
          dueAt: string | null;
        }>;
      };
      monthly: {
        count: number;
        completedCount: number;
        completion: number;
        items: Array<{
          taskId: string;
          title: string;
          status: string;
          priority: string;
          dueAt: string | null;
        }>;
      };
      quarterly: {
        count: number;
        completedCount: number;
        completion: number;
        items: Array<{
          taskId: string;
          title: string;
          status: string;
          priority: string;
          dueAt: string | null;
        }>;
      };
    };
  };
  goals: {
    count: number;
    averageProgress: number;
    byPeriod: {
      weekly: { count: number; averageProgress: number; items: GoalItem[] };
      monthly: { count: number; averageProgress: number; items: GoalItem[] };
      quarterly: { count: number; averageProgress: number; items: GoalItem[] };
    };
  };
};

const periodOrder = ["weekly", "monthly", "quarterly"] as const;

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedTaskPeriod, setExpandedTaskPeriod] = useState<"weekly" | "monthly" | "quarterly" | null>(null);
  const [expandedPeriod, setExpandedPeriod] = useState<"weekly" | "monthly" | "quarterly" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setError("not-auth");
      return;
    }

    setLoading(true);
    authedFetch<Summary>("/dashboard/summary")
      .then(setSummary)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main>
      <Header title="Dashboard" />
      <div className="space-y-4 px-4 py-4 md:grid md:grid-cols-2 md:gap-6 md:space-y-0 md:px-8 md:py-8 lg:grid-cols-3">
        {error === "not-auth" ? (
          <div className="md:col-span-full">
            <MobileCard>
              <p className="text-sm">You need to sign in first.</p>
              <Link className="mt-2 inline-block text-sm font-semibold text-primary" href="/login">
                Open Login
              </Link>
            </MobileCard>
          </div>
        ) : null}

        {error && error !== "not-auth" ? <p className="text-sm text-red-600 md:col-span-full">{error}</p> : null}
        {loading ? <p className="text-sm text-slate-500 md:col-span-full">Loading dashboard...</p> : null}

        <MobileCard>
          <p className="text-sm text-slate-500">Task Progress</p>
          <p className="mt-2 text-3xl font-bold">{summary?.tasks.completed ?? 0} Completed</p>
          <p className="text-xs text-slate-500">{summary?.tasks.active ?? 0} active, {summary?.tasks.overdue ?? 0} overdue</p>

          <div className="mt-4 space-y-2">
            {periodOrder.map((period) => {
              const periodData = summary?.tasks.byPeriod?.[period];
              const isExpanded = expandedTaskPeriod === period;
              return (
                <div className="rounded-lg border border-slate-200 p-2" key={`task-${period}`}>
                  <button
                    className="flex w-full items-center justify-between text-left"
                    onClick={() => setExpandedTaskPeriod(isExpanded ? null : period)}
                    type="button"
                  >
                    <div>
                      <p className="text-sm font-semibold capitalize">{period}</p>
                      <p className="text-xs text-slate-500">
                        {periodData?.completion ?? 0}% | {periodData?.completedCount ?? 0}/{periodData?.count ?? 0}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-primary">{isExpanded ? "Collapse" : "Expand"}</span>
                  </button>

                  {isExpanded ? (
                    <div className="mt-2 space-y-2 border-t border-slate-100 pt-2">
                      {(periodData?.items ?? []).length === 0 ? (
                        <p className="text-xs text-slate-500">No tasks in this period.</p>
                      ) : (
                        (periodData?.items ?? []).map((item) => (
                          <Link className="block rounded-md bg-slate-50 p-2" href={`/tasks?taskId=${item.taskId}`} key={item.taskId}>
                            <p className="text-xs font-semibold">{item.title}</p>
                            <p className="text-[11px] text-slate-500">
                              {item.status} | {item.priority} | {item.dueAt ? new Date(item.dueAt).toLocaleDateString() : "No deadline"}
                            </p>
                          </Link>
                        ))
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </MobileCard>

        <MobileCard>
          <p className="text-sm text-slate-500">Goal Completion (Summary)</p>
          <p className="mt-1 text-3xl font-bold">{summary?.goals.averageProgress ?? 0}%</p>
          <div className="mt-3 h-2 w-full rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, summary?.goals.averageProgress ?? 0)}%` }} />
          </div>

          <div className="mt-4 space-y-2">
            {periodOrder.map((period) => {
              const periodData = summary?.goals.byPeriod?.[period];
              const isExpanded = expandedPeriod === period;
              return (
                <div className="rounded-lg border border-slate-200 p-2" key={period}>
                  <button
                    className="flex w-full items-center justify-between text-left"
                    onClick={() => setExpandedPeriod(isExpanded ? null : period)}
                    type="button"
                  >
                    <div>
                      <p className="text-sm font-semibold capitalize">{period}</p>
                      <p className="text-xs text-slate-500">
                        {periodData?.count ?? 0} goals | {periodData?.averageProgress ?? 0}% avg
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-primary">{isExpanded ? "Collapse" : "Expand"}</span>
                  </button>

                  {isExpanded ? (
                    <div className="mt-2 space-y-2 border-t border-slate-100 pt-2">
                      {(periodData?.items ?? []).length === 0 ? (
                        <p className="text-xs text-slate-500">No goals in this period.</p>
                      ) : (
                        (periodData?.items ?? []).map((item) => (
                          <Link className="block rounded-md bg-slate-50 p-2" href={`/goals?period=${period}&goalId=${item.goalId}`} key={item.goalId}>
                            <p className="text-xs font-semibold">{item.title}</p>
                            <p className="text-[11px] text-slate-500">
                              {item.completedCount} of {item.targetValue} {item.unit} | {item.progress}%
                            </p>
                          </Link>
                        ))
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </MobileCard>

        <MobileCard>
          <p className="text-sm font-semibold">Pending</p>
          <ul className="mt-2 list-disc pl-5 text-sm text-slate-600">
            <li>Create your weekly goals</li>
            <li>Add reminders for important tasks</li>
            <li>Configure notification channels in Profile</li>
          </ul>
        </MobileCard>
      </div>
    </main>
  );
}
