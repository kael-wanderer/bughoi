import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getAuthUser } from "../lib/auth-user.js";

function periodBounds(period: "weekly" | "monthly" | "quarterly"): { start: Date; end: Date } {
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

function taskPivotDate(task: { completedAt: Date | null; dueAt: Date | null; createdAt: Date }): Date {
  return task.completedAt ?? task.dueAt ?? task.createdAt;
}

export async function dashboardRoutes(app: FastifyInstance) {
  app.get("/dashboard/summary", { preHandler: [app.authenticate] }, async (request) => {
    const userId = getAuthUser(request).userId;
    const query = z.object({ period: z.enum(["weekly", "monthly", "quarterly"]).optional() }).parse(request.query);

    const [activeTasks, completedTasks, overdueTasks, allTasks, goals, allGoals] = await Promise.all([
      prisma.task.count({ where: { userId, status: "active" } }),
      prisma.task.count({ where: { userId, status: "completed" } }),
      prisma.task.count({ where: { userId, status: "active", dueAt: { lt: new Date() } } }),
      prisma.task.findMany({
        where: { userId, parentTaskId: null },
        orderBy: { createdAt: "desc" }
      }),
      prisma.goal.findMany({
        where: { userId, ...(query.period ? { periodType: query.period } : {}) },
        include: { checkins: true }
      }),
      prisma.goal.findMany({
        where: { userId },
        include: { checkins: true }
      })
    ]);

    const goalProgress = goals.map((goal) => {
      const total = goal.checkins.length;
      const progress = goal.targetValue > 0 ? Math.min(100, (total / goal.targetValue) * 100) : 0;
      return {
        goalId: goal.id,
        title: goal.title,
        periodType: goal.periodType,
        completedCount: total,
        progress: Number(progress.toFixed(2))
      };
    });

    const avgGoalProgress =
      goalProgress.length > 0
        ? Number((goalProgress.reduce((sum, g) => sum + g.progress, 0) / goalProgress.length).toFixed(2))
        : 0;

    const periods: Array<"weekly" | "monthly" | "quarterly"> = ["weekly", "monthly", "quarterly"];
    const taskByPeriod = periods.reduce(
      (acc, period) => {
        const bounds = periodBounds(period);
        const items = allTasks
          .filter((task) => {
            const pivot = taskPivotDate(task);
            return pivot >= bounds.start && pivot <= bounds.end;
          })
          .map((task) => ({
            taskId: task.id,
            title: task.title,
            status: task.status,
            priority: task.priority,
            dueAt: task.dueAt
          }));
        const completedCount = items.filter((item) => item.status === "completed").length;
        const completion = items.length > 0 ? Number(((completedCount / items.length) * 100).toFixed(2)) : 0;

        acc[period] = {
          count: items.length,
          completedCount,
          completion,
          items
        };
        return acc;
      },
      {} as Record<
        "weekly" | "monthly" | "quarterly",
        {
          count: number;
          completedCount: number;
          completion: number;
          items: Array<{
            taskId: string;
            title: string;
            status: string;
            priority: string;
            dueAt: Date | null;
          }>;
        }
      >
    );

    const byPeriod = periods.reduce(
      (acc, period) => {
        const periodGoals = allGoals.filter((g) => g.periodType === period);
        const items = periodGoals.map((goal) => {
          const completedCount = goal.checkins.length;
          const progress = goal.targetValue > 0 ? Math.min(100, (completedCount / goal.targetValue) * 100) : 0;
          return {
            goalId: goal.id,
            title: goal.title,
            completedCount,
            targetValue: goal.targetValue,
            unit: goal.unit,
            progress: Number(progress.toFixed(2))
          };
        });
        const averageProgress =
          items.length > 0 ? Number((items.reduce((sum, item) => sum + item.progress, 0) / items.length).toFixed(2)) : 0;

        acc[period] = {
          count: items.length,
          averageProgress,
          items
        };
        return acc;
      },
      {} as Record<
        "weekly" | "monthly" | "quarterly",
        {
          count: number;
          averageProgress: number;
          items: Array<{
            goalId: string;
            title: string;
            completedCount: number;
            targetValue: number;
            unit: string;
            progress: number;
          }>;
        }
      >
    );

    return {
      tasks: {
        active: activeTasks,
        completed: completedTasks,
        overdue: overdueTasks,
        byPeriod: taskByPeriod
      },
      goals: {
        count: goals.length,
        averageProgress: avgGoalProgress,
        items: goalProgress,
        byPeriod
      }
    };
  });
}
