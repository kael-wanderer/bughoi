import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { env } from "../lib/env.js";

function assertN8nToken(authHeader?: string) {
  if (!authHeader?.startsWith("Bearer ")) {
    return false;
  }
  const token = authHeader.slice("Bearer ".length);
  return token === env.n8nApiToken;
}

export async function integrationRoutes(app: FastifyInstance) {
  app.get("/integrations/n8n/reminders/pending", async (request, reply) => {
    if (!assertN8nToken(request.headers.authorization)) {
      return reply.code(401).send({ message: "Unauthorized" });
    }

    const query = z.object({ before: z.string().datetime().optional() }).parse(request.query);
    const beforeDate = query.before ? new Date(query.before) : new Date();

    const reminders = await prisma.taskReminder.findMany({
      where: {
        remindAt: { lte: beforeDate },
        status: "pending"
      },
      include: {
        task: {
          include: {
            user: true
          }
        }
      },
      take: 100,
      orderBy: { remindAt: "asc" }
    });

    return reminders;
  });

  app.post("/integrations/n8n/reminders/:id/mark-sent", async (request, reply) => {
    if (!assertN8nToken(request.headers.authorization)) {
      return reply.code(401).send({ message: "Unauthorized" });
    }

    const params = z.object({ id: z.string().uuid() }).parse(request.params);

    return prisma.taskReminder.update({
      where: { id: params.id },
      data: {
        status: "sent",
        sentAt: new Date()
      }
    });
  });
}
