import type { FastifyInstance } from "fastify";
import { createReminderSchema, createTaskSchema } from "@bug/shared";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getAuthUser } from "../lib/auth-user.js";

const taskFilterSchema = z.object({
  status: z.enum(["active", "completed", "overdue"]).optional()
});

const updateTaskSchema = createTaskSchema.partial();
const updateReminderSchema = createReminderSchema.partial();

function computeReminderAt(
  dueAt: Date | null,
  reminderPreset?: string,
  customReminderAt?: string
): Date | null {
  if (!reminderPreset || reminderPreset === "none") {
    return null;
  }

  if (reminderPreset === "custom") {
    return customReminderAt ? new Date(customReminderAt) : null;
  }

  if (!dueAt) {
    return null;
  }

  const offsets: Record<string, number> = {
    "1_day_before": 1,
    "2_days_before": 2,
    "3_days_before": 3,
    "1_week_before": 7,
    "2_weeks_before": 14,
    "3_weeks_before": 21
  };

  const days = offsets[reminderPreset] ?? 0;
  if (days <= 0) {
    return null;
  }

  const date = new Date(dueAt);
  date.setDate(date.getDate() - days);
  return date;
}

export async function taskRoutes(app: FastifyInstance) {
  app.get("/tasks", { preHandler: [app.authenticate] }, async (request) => {
    const userId = getAuthUser(request).userId;
    const query = taskFilterSchema.parse(request.query);

    if (query.status === "overdue") {
      const overdue = await prisma.task.findMany({
        where: {
          userId,
          parentTaskId: null,
          status: "active",
          dueAt: { lt: new Date() }
        },
        include: {
          reminders: true,
          subtasks: { include: { reminders: true }, orderBy: { createdAt: "asc" } }
        },
        orderBy: { dueAt: "asc" }
      });

      return overdue.map((task) => ({ ...task, status: "overdue" }));
    }

    return prisma.task.findMany({
      where: {
        userId,
        parentTaskId: null,
        ...(query.status ? { status: query.status } : {})
      },
      include: {
        reminders: true,
        subtasks: { include: { reminders: true }, orderBy: { createdAt: "asc" } }
      },
      orderBy: { createdAt: "desc" }
    });
  });

  app.post("/tasks", { preHandler: [app.authenticate] }, async (request) => {
    const userId = getAuthUser(request).userId;
    const payload = createTaskSchema.parse(request.body);

    return prisma.$transaction(async (tx) => {
      const dueAt = payload.dueAt ? new Date(payload.dueAt) : null;
      const parentTask = await tx.task.create({
        data: {
          userId,
          goalId: payload.goalId,
          title: payload.title,
          category: payload.category,
          description: payload.description,
          dueAt,
          priority: payload.priority,
          reminderPreset: payload.reminderPreset,
          customReminderAt: payload.customReminderAt ? new Date(payload.customReminderAt) : null,
          repeatRule: payload.repeatRule,
          repeatCustom: payload.repeatCustom,
          repeatEndType: payload.repeatEndType,
          repeatEndDate: payload.repeatEndDate ? new Date(payload.repeatEndDate) : null,
          tags: payload.tags,
          notificationChannel: payload.notificationChannel
        }
      });

      const reminderAt = computeReminderAt(dueAt, payload.reminderPreset, payload.customReminderAt);
      if (reminderAt && payload.notificationChannel !== "off") {
        await tx.taskReminder.create({
          data: {
            taskId: parentTask.id,
            remindAt: reminderAt,
            channel: payload.notificationChannel === "all" ? "email" : payload.notificationChannel
          }
        });
      }

      for (const subtask of payload.subtasks) {
        const subDueAt = subtask.dueAt ? new Date(subtask.dueAt) : null;
        const createdSubtask = await tx.task.create({
          data: {
            userId,
            parentTaskId: parentTask.id,
            title: subtask.title,
            category: subtask.category,
            description: subtask.description,
            dueAt: subDueAt,
            priority: subtask.priority,
            reminderPreset: subtask.reminderPreset,
            customReminderAt: subtask.customReminderAt ? new Date(subtask.customReminderAt) : null,
            repeatRule: subtask.repeatRule,
            repeatCustom: subtask.repeatCustom,
            repeatEndType: subtask.repeatEndType,
            repeatEndDate: subtask.repeatEndDate ? new Date(subtask.repeatEndDate) : null,
            tags: subtask.tags,
            notificationChannel: subtask.notificationChannel
          }
        });

        const subReminderAt = computeReminderAt(subDueAt, subtask.reminderPreset, subtask.customReminderAt);
        if (subReminderAt && subtask.notificationChannel !== "off") {
          await tx.taskReminder.create({
            data: {
              taskId: createdSubtask.id,
              remindAt: subReminderAt,
              channel: subtask.notificationChannel === "all" ? "email" : subtask.notificationChannel
            }
          });
        }
      }

      return tx.task.findUnique({
        where: { id: parentTask.id },
        include: {
          reminders: true,
          subtasks: { include: { reminders: true }, orderBy: { createdAt: "asc" } }
        }
      });
    });
  });

  app.patch("/tasks/:taskId", { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = getAuthUser(request).userId;
    const params = z.object({ taskId: z.string().uuid() }).parse(request.params);
    const payload = updateTaskSchema.parse(request.body);
    const task = await prisma.task.findFirst({ where: { id: params.taskId, userId } });
    if (!task) {
      return reply.code(404).send({ message: "Task not found" });
    }

    return prisma.task.update({
      where: { id: params.taskId },
      data: {
        ...(payload.title ? { title: payload.title } : {}),
        ...(payload.category ? { category: payload.category } : {}),
        ...(payload.description ? { description: payload.description } : {}),
        ...(payload.priority ? { priority: payload.priority } : {}),
        ...(payload.dueAt ? { dueAt: new Date(payload.dueAt) } : {}),
        ...(payload.goalId ? { goalId: payload.goalId } : {}),
        ...(payload.reminderPreset ? { reminderPreset: payload.reminderPreset } : {}),
        ...(payload.customReminderAt ? { customReminderAt: new Date(payload.customReminderAt) } : {}),
        ...(payload.repeatRule ? { repeatRule: payload.repeatRule } : {}),
        ...(payload.repeatCustom ? { repeatCustom: payload.repeatCustom } : {}),
        ...(payload.repeatEndType ? { repeatEndType: payload.repeatEndType } : {}),
        ...(payload.repeatEndDate ? { repeatEndDate: new Date(payload.repeatEndDate) } : {}),
        ...(payload.tags ? { tags: payload.tags } : {}),
        ...(payload.notificationChannel ? { notificationChannel: payload.notificationChannel } : {})
      }
    });
  });

  app.post("/tasks/:taskId/complete", { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = getAuthUser(request).userId;
    const params = z.object({ taskId: z.string().uuid() }).parse(request.params);
    const task = await prisma.task.findFirst({ where: { id: params.taskId, userId } });
    if (!task) {
      return reply.code(404).send({ message: "Task not found" });
    }

    return prisma.task.update({
      where: { id: params.taskId },
      data: {
        status: "completed",
        completedAt: new Date()
      }
    });
  });

  app.post("/tasks/:taskId/reminders", { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = getAuthUser(request).userId;
    const params = z.object({ taskId: z.string().uuid() }).parse(request.params);
    const payload = createReminderSchema.parse(request.body);

    const task = await prisma.task.findFirst({ where: { id: params.taskId, userId } });
    if (!task) {
      return reply.code(404).send({ message: "Task not found" });
    }

    return prisma.taskReminder.create({
      data: {
        taskId: params.taskId,
        remindAt: new Date(payload.remindAt),
        channel: payload.channel
      }
    });
  });

  app.patch("/tasks/:taskId/reminders/:reminderId", { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = getAuthUser(request).userId;
    const params = z.object({ taskId: z.string().uuid(), reminderId: z.string().uuid() }).parse(request.params);
    const payload = updateReminderSchema.parse(request.body);

    const reminder = await prisma.taskReminder.findFirst({
      where: {
        id: params.reminderId,
        taskId: params.taskId,
        task: { userId }
      }
    });
    if (!reminder) {
      return reply.code(404).send({ message: "Reminder not found" });
    }

    return prisma.taskReminder.update({
      where: { id: params.reminderId },
      data: {
        ...(payload.remindAt ? { remindAt: new Date(payload.remindAt) } : {}),
        ...(payload.channel ? { channel: payload.channel } : {})
      }
    });
  });

  app.delete("/tasks/:taskId/reminders/:reminderId", { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = getAuthUser(request).userId;
    const params = z.object({ taskId: z.string().uuid(), reminderId: z.string().uuid() }).parse(request.params);

    const reminder = await prisma.taskReminder.findFirst({
      where: {
        id: params.reminderId,
        taskId: params.taskId,
        task: { userId }
      }
    });
    if (!reminder) {
      return reply.code(404).send({ message: "Reminder not found" });
    }

    await prisma.taskReminder.delete({ where: { id: params.reminderId } });
    return { ok: true };
  });

  app.delete("/tasks/:taskId", { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = getAuthUser(request).userId;
    const params = z.object({ taskId: z.string().uuid() }).parse(request.params);
    const task = await prisma.task.findFirst({ where: { id: params.taskId, userId } });
    if (!task) {
      return reply.code(404).send({ message: "Task not found" });
    }

    await prisma.task.delete({ where: { id: params.taskId } });
    return { ok: true };
  });
}
