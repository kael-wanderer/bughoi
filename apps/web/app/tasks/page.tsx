"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Header } from "../../components/header";
import { MobileCard } from "../../components/mobile-card";
import { authedFetch, getToken } from "../../lib/auth-client";

type Reminder = {
  id: string;
  remindAt: string;
  channel: "email" | "telegram" | "webpush";
  status: "pending" | "sent" | "failed";
};

type Task = {
  id: string;
  title: string;
  category: string;
  description?: string | null;
  dueAt: string | null;
  priority: "low" | "medium" | "high";
  reminderPreset?: string | null;
  customReminderAt?: string | null;
  repeatRule?: string | null;
  repeatCustom?: string | null;
  repeatEndType?: string | null;
  repeatEndDate?: string | null;
  tags: string[];
  notificationChannel: "off" | "email" | "telegram" | "all";
  status: "active" | "completed" | "overdue";
  reminders: Reminder[];
  subtasks?: Task[];
};

type SubtaskDraft = {
  title: string;
  category: "Project" | "Once Time" | "Weekly" | "Monthly" | "Customer";
  description: string;
  dueAt: string;
  priority: "low" | "medium" | "high";
  reminderPreset: string;
  customReminderAt: string;
  repeatRule: string;
  repeatCustom: string;
  repeatEndType: "never" | "on_date";
  repeatEndDate: string;
  tagsInput: string;
  notificationChannel: "off" | "email" | "telegram" | "all";
};

const categoryOptions = ["Project", "Once Time", "Weekly", "Monthly", "Customer"] as const;
const reminderOptions = [
  { value: "none", label: "None" },
  { value: "1_day_before", label: "1 day before" },
  { value: "2_days_before", label: "2 days before" },
  { value: "3_days_before", label: "3 days before" },
  { value: "1_week_before", label: "1 week before" },
  { value: "2_weeks_before", label: "2 weeks before" },
  { value: "3_weeks_before", label: "3 weeks before" },
  { value: "custom", label: "Custom" }
];
const repeatOptions = [
  { value: "none", label: "No repeat" },
  { value: "hourly", label: "Hourly" },
  { value: "daily", label: "Daily" },
  { value: "weekdays", label: "Weekdays" },
  { value: "weekends", label: "Weekends" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" },
  { value: "every_3_months", label: "Every 3 months" },
  { value: "every_6_months", label: "Every 6 months" },
  { value: "yearly", label: "Yearly" },
  { value: "custom", label: "Custom" }
];

function emptySubtask(): SubtaskDraft {
  return {
    title: "",
    category: "Once Time",
    description: "",
    dueAt: "",
    priority: "medium",
    reminderPreset: "none",
    customReminderAt: "",
    repeatRule: "none",
    repeatCustom: "",
    repeatEndType: "never",
    repeatEndDate: "",
    tagsInput: "",
    notificationChannel: "all"
  };
}

function parseTags(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function FieldLabel({ children }: { children: string }) {
  return <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{children}</p>;
}

export default function TasksPage() {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const pageSize = 3;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [status, setStatus] = useState<"all" | "active" | "completed" | "overdue">("all");
  const [sortBy, setSortBy] = useState<"deadline" | "name">("deadline");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [formExpanded, setFormExpanded] = useState(false);

  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [category, setCategory] = useState<(typeof categoryOptions)[number]>("Once Time");
  const [description, setDescription] = useState("");
  const [reminderPreset, setReminderPreset] = useState("none");
  const [customReminderAt, setCustomReminderAt] = useState("");
  const [repeatRule, setRepeatRule] = useState("none");
  const [repeatCustom, setRepeatCustom] = useState("");
  const [repeatEndType, setRepeatEndType] = useState<"never" | "on_date">("never");
  const [repeatEndDate, setRepeatEndDate] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [notificationChannel, setNotificationChannel] = useState<"off" | "email" | "telegram" | "all">("all");
  const [subtasks, setSubtasks] = useState<SubtaskDraft[]>([]);

  const [query, setQuery] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!success) return;
    const t = window.setTimeout(() => setSuccess(null), 2500);
    return () => window.clearTimeout(t);
  }, [success]);

  const titleError = title.trim().length === 0 ? "Task name is required" : null;

  async function loadTasks(nextStatus: "all" | "active" | "completed" | "overdue") {
    setLoading(true);
    try {
      const data = await authedFetch<Task[]>(nextStatus === "all" ? "/tasks" : `/tasks?status=${nextStatus}`);
      setTasks(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSelectedTaskId(params.get("taskId"));
  }, []);

  useEffect(() => {
    if (!getToken()) {
      setError("not-auth");
      return;
    }
    loadTasks(status);
  }, [status]);

  function resetForm() {
    setTitle("");
    setDueAt("");
    setPriority("medium");
    setCategory("Once Time");
    setDescription("");
    setReminderPreset("none");
    setCustomReminderAt("");
    setRepeatRule("none");
    setRepeatCustom("");
    setRepeatEndType("never");
    setRepeatEndDate("");
    setTagsInput("");
    setNotificationChannel("all");
    setSubtasks([]);
    setEditingTaskId(null);
    setFormExpanded(false);
  }

  async function createTask(event: FormEvent) {
    event.preventDefault();
    if (titleError) {
      setError(titleError);
      return;
    }

    setBusy(true);
    try {
      await authedFetch("/tasks", {
        method: "POST",
        body: JSON.stringify({
          title,
          dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
          priority,
          category,
          description: description || undefined,
          reminderPreset,
          customReminderAt: reminderPreset === "custom" && customReminderAt ? new Date(customReminderAt).toISOString() : undefined,
          repeatRule,
          repeatCustom: repeatRule === "custom" ? repeatCustom : undefined,
          repeatEndType,
          repeatEndDate: repeatEndType === "on_date" && repeatEndDate ? new Date(repeatEndDate).toISOString() : undefined,
          tags: parseTags(tagsInput),
          notificationChannel,
          subtasks: subtasks
            .filter((st) => st.title.trim())
            .map((st) => ({
              title: st.title,
              category: st.category,
              description: st.description || undefined,
              dueAt: st.dueAt ? new Date(st.dueAt).toISOString() : undefined,
              priority: st.priority,
              reminderPreset: st.reminderPreset,
              customReminderAt:
                st.reminderPreset === "custom" && st.customReminderAt ? new Date(st.customReminderAt).toISOString() : undefined,
              repeatRule: st.repeatRule,
              repeatCustom: st.repeatRule === "custom" ? st.repeatCustom : undefined,
              repeatEndType: st.repeatEndType,
              repeatEndDate: st.repeatEndType === "on_date" && st.repeatEndDate ? new Date(st.repeatEndDate).toISOString() : undefined,
              tags: parseTags(st.tagsInput),
              notificationChannel: st.notificationChannel
            }))
        })
      });
      setSuccess("Task saved");
      resetForm();
      await loadTasks(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save task");
    } finally {
      setBusy(false);
    }
  }

  async function saveTask(taskId: string) {
    if (titleError) {
      setError(titleError);
      return;
    }

    setBusy(true);
    try {
      await authedFetch(`/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title,
          dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
          priority,
          category,
          description: description || undefined,
          reminderPreset,
          customReminderAt: reminderPreset === "custom" && customReminderAt ? new Date(customReminderAt).toISOString() : undefined,
          repeatRule,
          repeatCustom: repeatRule === "custom" ? repeatCustom : undefined,
          repeatEndType,
          repeatEndDate: repeatEndType === "on_date" && repeatEndDate ? new Date(repeatEndDate).toISOString() : undefined,
          tags: parseTags(tagsInput),
          notificationChannel
        })
      });
      setSuccess("Task updated");
      resetForm();
      await loadTasks(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task");
    } finally {
      setBusy(false);
    }
  }

  async function deleteTask(taskId: string) {
    if (!window.confirm("Delete this task?")) return;
    setBusy(true);
    try {
      await authedFetch(`/tasks/${taskId}`, { method: "DELETE" });
      setSuccess("Task deleted");
      await loadTasks(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete task");
    } finally {
      setBusy(false);
    }
  }

  async function markComplete(taskId: string) {
    setBusy(true);
    try {
      await authedFetch(`/tasks/${taskId}/complete`, { method: "POST" });
      setSuccess("Task completed");
      await loadTasks(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task");
    } finally {
      setBusy(false);
    }
  }

  function beginTaskEdit(task: Task) {
    setFormExpanded(true);
    setEditingTaskId(task.id);
    setTitle(task.title);
    setDueAt(task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 16) : "");
    setPriority(task.priority);
    setCategory((categoryOptions.includes(task.category as (typeof categoryOptions)[number])
      ? task.category
      : "Once Time") as (typeof categoryOptions)[number]);
    setDescription(task.description ?? "");
    setReminderPreset(task.reminderPreset ?? "none");
    setCustomReminderAt(task.customReminderAt ? new Date(task.customReminderAt).toISOString().slice(0, 16) : "");
    setRepeatRule(task.repeatRule ?? "none");
    setRepeatCustom(task.repeatCustom ?? "");
    setRepeatEndType(task.repeatEndType === "on_date" ? "on_date" : "never");
    setRepeatEndDate(task.repeatEndDate ? new Date(task.repeatEndDate).toISOString().slice(0, 10) : "");
    setTagsInput((task.tags ?? []).join(", "));
    setNotificationChannel(task.notificationChannel ?? "all");
    setSubtasks([]);
  }

  function addSubtask() {
    setSubtasks((prev) => [...prev, emptySubtask()]);
  }

  function removeSubtask(index: number) {
    setSubtasks((prev) => prev.filter((_, i) => i !== index));
  }

  function updateSubtask(index: number, patch: Partial<SubtaskDraft>) {
    setSubtasks((prev) => prev.map((st, i) => (i === index ? { ...st, ...patch } : st)));
  }

  const filtered = useMemo(() => {
    const searched = tasks.filter((task) => task.title.toLowerCase().includes(query.toLowerCase()));
    const sorted = [...searched].sort((a, b) => {
      if (sortBy === "name") {
        const cmp = a.title.localeCompare(b.title);
        return sortOrder === "asc" ? cmp : -cmp;
      }

      const aTime = a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY;
      const bTime = b.dueAt ? new Date(b.dueAt).getTime() : Number.POSITIVE_INFINITY;
      const cmp = aTime - bTime;
      return sortOrder === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [query, sortBy, sortOrder, tasks]);

  useEffect(() => {
    setPage(1);
  }, [query, sortBy, sortOrder, status, tasks]);

  useEffect(() => {
    if (!selectedTaskId) {
      return;
    }
    const idx = filtered.findIndex((t) => t.id === selectedTaskId);
    if (idx >= 0) {
      setPage(Math.floor(idx / pageSize) + 1);
    }
  }, [filtered, selectedTaskId]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedTasks = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage]);

  return (
    <main>
      <Header title="Tasks" />
      <div className="space-y-4 px-4 py-4 pb-28">
        {error === "not-auth" ? (
          <MobileCard>
            <p className="text-sm">You need to sign in first.</p>
            <Link className="mt-2 inline-block text-sm font-semibold text-primary" href="/login">
              Open Login
            </Link>
          </MobileCard>
        ) : null}

        <div className="grid grid-cols-4 gap-2 rounded-xl bg-white p-1 text-xs font-semibold">
          <button className={`rounded-lg py-2 ${status === "all" ? "bg-primary text-white" : "text-slate-500"}`} onClick={() => setStatus("all")} type="button">All</button>
          <button className={`rounded-lg py-2 ${status === "active" ? "bg-primary text-white" : "text-slate-500"}`} onClick={() => setStatus("active")} type="button">Active</button>
          <button className={`rounded-lg py-2 ${status === "completed" ? "bg-primary text-white" : "text-slate-500"}`} onClick={() => setStatus("completed")} type="button">Done</button>
          <button className={`rounded-lg py-2 ${status === "overdue" ? "bg-primary text-white" : "text-slate-500"}`} onClick={() => setStatus("overdue")} type="button">Overdue</button>
        </div>

        <input className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" disabled={busy} onChange={(e) => setQuery(e.target.value)} placeholder="Search tasks" type="search" value={query} />
        <div className="grid grid-cols-2 gap-2">
          <select
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"
            disabled={busy}
            onChange={(e) => setSortBy(e.target.value as "deadline" | "name")}
            value={sortBy}
          >
            <option value="deadline">Sort by deadline</option>
            <option value="name">Sort by name</option>
          </select>
          <select
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"
            disabled={busy}
            onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
            value={sortOrder}
          >
            <option value="asc">ASC</option>
            <option value="desc">DESC</option>
          </select>
        </div>

        {loading ? <p className="text-sm text-slate-500">Loading tasks...</p> : null}
        {success ? <p className="text-sm text-emerald-600">{success}</p> : null}
        {error && error !== "not-auth" ? <p className="text-sm text-red-600">{error}</p> : null}
        {!loading && filtered.length === 0 ? <p className="text-sm text-slate-500">No tasks in this list.</p> : null}

        {pagedTasks.map((task) => (
          <MobileCard key={task.id}>
            <div className={selectedTaskId === task.id ? "rounded-md border border-primary p-2" : ""}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{task.title}</p>
                <p className="text-xs text-slate-500">
                  {task.category} | {task.dueAt ? new Date(task.dueAt).toLocaleString() : "No date"}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Repeat: {task.repeatRule || "none"} | Notify: {task.notificationChannel}
                </p>
                {task.tags?.length ? <p className="mt-1 text-[11px] text-slate-500">Tags: {task.tags.join(", ")}</p> : null}
                {task.subtasks?.length ? <p className="mt-1 text-[11px] text-slate-500">Subtasks: {task.subtasks.length}</p> : null}
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase text-primary">{task.priority}</span>
                {task.status !== "completed" ? (
                  <button className="text-xs font-semibold text-primary disabled:opacity-60" disabled={busy} onClick={() => markComplete(task.id)} type="button">
                    Mark Done
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button className="rounded-lg border border-slate-300 py-2 text-xs font-semibold disabled:opacity-60" disabled={busy} onClick={() => beginTaskEdit(task)} type="button">Edit Task</button>
              <button className="rounded-lg border border-rose-300 py-2 text-xs font-semibold text-rose-600 disabled:opacity-60" disabled={busy} onClick={() => deleteTask(task.id)} type="button">Delete Task</button>
            </div>
            </div>
          </MobileCard>
        ))}

        {filtered.length > pageSize ? (
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

        <div>
          <MobileCard>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">{editingTaskId ? "Edit Task" : "Quick Add"}</p>
              <button
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-primary"
                onClick={() => setFormExpanded((v) => !v)}
                type="button"
              >
                {formExpanded ? "Collapse" : "Create Task"}
              </button>
            </div>

            {formExpanded ? <form className="space-y-3" onSubmit={createTask}>

              <div>
                <FieldLabel>Task Name</FieldLabel>
                <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" onChange={(e) => setTitle(e.target.value)} placeholder="Task name" disabled={busy} value={title} />
              </div>
              {titleError ? <p className="text-xs text-rose-600">{titleError}</p> : null}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <FieldLabel>Deadline</FieldLabel>
                  <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" onChange={(e) => setDueAt(e.target.value)} type="datetime-local" disabled={busy} value={dueAt} />
                </div>
                <div>
                  <FieldLabel>Priority</FieldLabel>
                  <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" disabled={busy} onChange={(e) => setPriority(e.target.value as "low" | "medium" | "high")} value={priority}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div>
                <FieldLabel>Category</FieldLabel>
                <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" disabled={busy} onChange={(e) => setCategory(e.target.value as (typeof categoryOptions)[number])} value={category}>
                  {categoryOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div>
                <FieldLabel>Description</FieldLabel>
                <textarea className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" disabled={busy} onChange={(e) => setDescription(e.target.value)} placeholder="Description" rows={3} value={description} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <FieldLabel>Reminder</FieldLabel>
                  <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" disabled={busy} onChange={(e) => setReminderPreset(e.target.value)} value={reminderPreset}>
                    {reminderOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <FieldLabel>Custom Reminder Time</FieldLabel>
                  {reminderPreset === "custom" ? (
                    <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" type="datetime-local" disabled={busy} onChange={(e) => setCustomReminderAt(e.target.value)} value={customReminderAt} />
                  ) : (
                    <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" disabled placeholder="Reminder auto from due date" />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <FieldLabel>Repeat</FieldLabel>
                  <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" disabled={busy} onChange={(e) => setRepeatRule(e.target.value)} value={repeatRule}>
                    {repeatOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <FieldLabel>{repeatRule === "custom" ? "Custom Repeat" : "End Repeat"}</FieldLabel>
                  {repeatRule === "custom" ? (
                    <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" disabled={busy} onChange={(e) => setRepeatCustom(e.target.value)} placeholder="Custom repeat rule" value={repeatCustom} />
                  ) : (
                    <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" disabled={busy} onChange={(e) => setRepeatEndType(e.target.value as "never" | "on_date")} value={repeatEndType}>
                      <option value="never">Never</option>
                      <option value="on_date">On date</option>
                    </select>
                  )}
                </div>
              </div>

              {repeatRule !== "custom" && repeatEndType === "on_date" ? (
                <div>
                  <FieldLabel>Repeat End Date</FieldLabel>
                  <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" type="date" disabled={busy} onChange={(e) => setRepeatEndDate(e.target.value)} value={repeatEndDate} />
                </div>
              ) : null}

              <div>
                <FieldLabel>Tags</FieldLabel>
                <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" disabled={busy} onChange={(e) => setTagsInput(e.target.value)} placeholder="Comma separated tags" value={tagsInput} />
              </div>

              <div>
                <FieldLabel>Notification</FieldLabel>
                <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" disabled={busy} onChange={(e) => setNotificationChannel(e.target.value as "off" | "email" | "telegram" | "all")} value={notificationChannel}>
                  <option value="off">Off</option>
                  <option value="email">Email</option>
                  <option value="telegram">Telegram</option>
                  <option value="all">All</option>
                </select>
              </div>

              <div className="space-y-2 rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold">Subtasks</p>
                  <button className="text-xs font-semibold text-primary" disabled={busy} onClick={addSubtask} type="button">+ Add Subtask</button>
                </div>

                {subtasks.map((st, index) => (
                  <div className="space-y-2 rounded-md border border-slate-200 p-2" key={index}>
                    <FieldLabel>Subtask Name</FieldLabel>
                    <input className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs" disabled={busy} onChange={(e) => updateSubtask(index, { title: e.target.value })} placeholder="Subtask name" value={st.title} />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <FieldLabel>Deadline</FieldLabel>
                        <input className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs" type="datetime-local" disabled={busy} onChange={(e) => updateSubtask(index, { dueAt: e.target.value })} value={st.dueAt} />
                      </div>
                      <div>
                        <FieldLabel>Priority</FieldLabel>
                        <select className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs" disabled={busy} onChange={(e) => updateSubtask(index, { priority: e.target.value as "low" | "medium" | "high" })} value={st.priority}>
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                      </div>
                    </div>
                    <FieldLabel>Category</FieldLabel>
                    <select className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs" disabled={busy} onChange={(e) => updateSubtask(index, { category: e.target.value as SubtaskDraft["category"] })} value={st.category}>
                      {categoryOptions.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    <FieldLabel>Description</FieldLabel>
                    <textarea className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs" rows={2} disabled={busy} onChange={(e) => updateSubtask(index, { description: e.target.value })} placeholder="Description" value={st.description} />
                    <FieldLabel>Tags</FieldLabel>
                    <input className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs" disabled={busy} onChange={(e) => updateSubtask(index, { tagsInput: e.target.value })} placeholder="Comma separated tags" value={st.tagsInput} />
                    <div className="grid grid-cols-2 gap-2">
                      <select className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs" disabled={busy} onChange={(e) => updateSubtask(index, { reminderPreset: e.target.value })} value={st.reminderPreset}>
                        {reminderOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      {st.reminderPreset === "custom" ? (
                        <input
                          className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                          type="datetime-local"
                          disabled={busy}
                          onChange={(e) => updateSubtask(index, { customReminderAt: e.target.value })}
                          value={st.customReminderAt}
                        />
                      ) : (
                        <input className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs" disabled placeholder="Reminder from due date" />
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                        disabled={busy}
                        onChange={(e) => updateSubtask(index, { repeatRule: e.target.value })}
                        value={st.repeatRule}
                      >
                        {repeatOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      <select
                        className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                        disabled={busy}
                        onChange={(e) => updateSubtask(index, { repeatEndType: e.target.value as "never" | "on_date" })}
                        value={st.repeatEndType}
                      >
                        <option value="never">End: Never</option>
                        <option value="on_date">End: On date</option>
                      </select>
                    </div>
                    {st.repeatRule === "custom" ? (
                      <input
                        className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                        disabled={busy}
                        onChange={(e) => updateSubtask(index, { repeatCustom: e.target.value })}
                        placeholder="Custom repeat rule"
                        value={st.repeatCustom}
                      />
                    ) : null}
                    {st.repeatEndType === "on_date" ? (
                      <input
                        className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                        type="date"
                        disabled={busy}
                        onChange={(e) => updateSubtask(index, { repeatEndDate: e.target.value })}
                        value={st.repeatEndDate}
                      />
                    ) : null}
                    <div>
                      <select className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs" disabled={busy} onChange={(e) => updateSubtask(index, { notificationChannel: e.target.value as "off" | "email" | "telegram" | "all" })} value={st.notificationChannel}>
                        <option value="off">Off</option>
                        <option value="email">Email</option>
                        <option value="telegram">Telegram</option>
                        <option value="all">All</option>
                      </select>
                    </div>
                    <button className="w-full rounded-md border border-rose-300 py-1 text-[11px] text-rose-600" disabled={busy} onClick={() => removeSubtask(index)} type="button">Remove Subtask</button>
                  </div>
                ))}
              </div>

              {editingTaskId ? (
                <div className="grid grid-cols-2 gap-2">
                  <button className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={busy || !!titleError} onClick={() => saveTask(editingTaskId)} type="button">
                    {busy ? "Saving..." : "Save Task"}
                  </button>
                  <button className="w-full rounded-lg border border-slate-300 py-2 text-sm disabled:opacity-60" disabled={busy} onClick={resetForm} type="button">Cancel</button>
                </div>
              ) : (
                <button className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={busy || !!titleError} type="submit">
                  {busy ? "Creating..." : "Create Task"}
                </button>
              )}
            </form> : null}
          </MobileCard>
        </div>
      </div>
    </main>
  );
}
