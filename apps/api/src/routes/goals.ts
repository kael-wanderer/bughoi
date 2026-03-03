import type { FastifyInstance } from "fastify";
import { createGoalSchema, goalCheckinSchema } from "@bug/shared";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getAuthUser } from "../lib/auth-user.js";

const updateGoalSchema = createGoalSchema.partial();

export async function goalRoutes(app: FastifyInstance) {
  app.get("/goals", { preHandler: [app.authenticate] }, async (request) => {
    const userId = getAuthUser(request).userId;
    const query = z.object({ period: z.enum(["weekly", "monthly", "quarterly"]).optional() }).parse(request.query);

    const goals = await prisma.goal.findMany({
      where: {
        userId,
        ...(query.period ? { periodType: query.period } : {})
      },
      include: { checkins: true },
      orderBy: { periodStart: "desc" }
    });

    return goals;
  });

  app.post("/goals", { preHandler: [app.authenticate] }, async (request) => {
    const userId = getAuthUser(request).userId;
    const payload = createGoalSchema.parse(request.body);

    return prisma.goal.create({
      data: {
        userId,
        title: payload.title,
        category: payload.category,
        periodType: payload.periodType,
        periodStart: new Date(payload.periodStart),
        periodEnd: new Date(payload.periodEnd),
        targetValue: payload.targetValue,
        unit: payload.unit
      }
    });
  });

  app.patch("/goals/:goalId", { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = getAuthUser(request).userId;
    const params = z.object({ goalId: z.string().uuid() }).parse(request.params);
    const payload = updateGoalSchema.parse(request.body);
    const goal = await prisma.goal.findFirst({ where: { id: params.goalId, userId } });
    if (!goal) {
      return reply.code(404).send({ message: "Goal not found" });
    }

    return prisma.goal.update({
      where: { id: params.goalId },
      data: {
        ...(payload.title ? { title: payload.title } : {}),
        ...(payload.category ? { category: payload.category } : {}),
        ...(payload.periodType ? { periodType: payload.periodType } : {}),
        ...(payload.periodStart ? { periodStart: new Date(payload.periodStart) } : {}),
        ...(payload.periodEnd ? { periodEnd: new Date(payload.periodEnd) } : {}),
        ...(payload.targetValue ? { targetValue: payload.targetValue } : {}),
        ...(payload.unit ? { unit: payload.unit } : {})
      }
    });
  });

  app.post("/goals/:goalId/checkins", { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = getAuthUser(request).userId;
    const params = z.object({ goalId: z.string().uuid() }).parse(request.params);
    const payload = goalCheckinSchema.parse(request.body);

    const goal = await prisma.goal.findFirst({ where: { id: params.goalId, userId } });
    if (!goal) {
      return reply.code(404).send({ message: "Goal not found" });
    }

    const candidateDate = payload.checkinDate ? new Date(payload.checkinDate) : new Date();
    if (Number.isNaN(candidateDate.getTime())) {
      return reply.code(400).send({ message: "Invalid check-in date" });
    }

    const now = new Date();
    const maxDate = new Date(now);
    maxDate.setHours(23, 59, 59, 999);
    const minDate = new Date(now);
    minDate.setHours(0, 0, 0, 0);
    minDate.setDate(minDate.getDate() - 60);

    if (candidateDate < minDate || candidateDate > maxDate) {
      return reply.code(400).send({ message: "Check-in date must be within last 60 days and not in the future" });
    }

    return prisma.goalCheckin.create({
      data: {
        goalId: params.goalId,
        value: payload.value ?? 1,
        durationMins: payload.durationMins,
        note: payload.note,
        checkinDate: candidateDate
      }
    });
  });

  app.delete("/goals/:goalId", { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = getAuthUser(request).userId;
    const params = z.object({ goalId: z.string().uuid() }).parse(request.params);
    const goal = await prisma.goal.findFirst({ where: { id: params.goalId, userId } });
    if (!goal) {
      return reply.code(404).send({ message: "Goal not found" });
    }

    await prisma.goal.delete({ where: { id: params.goalId } });
    return { ok: true };
  });
}
