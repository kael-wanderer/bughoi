import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getAuthUser } from "../lib/auth-user.js";
import { buildOtpAuthUri, generateTotpSecret, verifyTotpToken } from "../lib/totp.js";
import { env } from "../lib/env.js";

const updatePreferencesSchema = z.object({
  timezone: z.string().min(1).optional(),
  theme: z.enum(["orange", "gray", "green"]).optional()
});

const notificationChannelSchema = z.object({
  type: z.enum(["email", "telegram"]),
  enabled: z.boolean().default(true),
  value: z.string().min(1)
});

const upsertChannelsSchema = z.object({
  channels: z.array(notificationChannelSchema).max(2)
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8)
});

const twoFactorVerifySchema = z.object({
  otp: z.string().regex(/^\d{6}$/)
});

export async function profileRoutes(app: FastifyInstance) {
  app.get("/me", { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = getAuthUser(request).userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } }, channels: true }
    });

    if (!user) {
      return reply.code(404).send({ message: "User not found" });
    }

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      timezone: user.timezone,
      theme: user.theme,
      twoFactorEnabled: user.twoFactorEnabled,
      active: user.active,
      roles: user.roles.map((r: any) => r.role.name),
      channels: user.channels.map((c: any) => ({
        id: c.id,
        type: c.type,
        enabled: c.enabled,
        value: typeof c.configJson === "object" && c.configJson && "value" in c.configJson ? (c.configJson as { value?: string }).value : ""
      }))
    };
  });

  app.patch("/me/preferences", { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = getAuthUser(request).userId;
    const payload = updatePreferencesSchema.parse(request.body);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return reply.code(404).send({ message: "User not found" });
    }

    return prisma.user.update({
      where: { id: userId },
      data: {
        timezone: payload.timezone ?? user.timezone,
        theme: payload.theme ?? user.theme
      },
      select: {
        id: true,
        timezone: true,
        theme: true
      }
    });
  });

  app.patch("/me/notification-channels", { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = getAuthUser(request).userId;
    const payload = upsertChannelsSchema.parse(request.body);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return reply.code(404).send({ message: "User not found" });
    }

    await prisma.$transaction(async (tx: any) => {
      for (const channel of payload.channels) {
        const existing = await tx.notificationChannel.findFirst({
          where: { userId, type: channel.type }
        });

        if (existing) {
          await tx.notificationChannel.update({
            where: { id: existing.id },
            data: {
              enabled: channel.enabled,
              configJson: { value: channel.value }
            }
          });
        } else {
          await tx.notificationChannel.create({
            data: {
              userId,
              type: channel.type,
              enabled: channel.enabled,
              configJson: { value: channel.value }
            }
          });
        }
      }
    });

    const channels = await prisma.notificationChannel.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
    return {
      channels: channels.map((c: any) => ({
        id: c.id,
        type: c.type,
        enabled: c.enabled,
        value: typeof c.configJson === "object" && c.configJson && "value" in c.configJson ? (c.configJson as { value?: string }).value : ""
      }))
    };
  });

  app.patch("/me/password", { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = getAuthUser(request).userId;
    const payload = changePasswordSchema.parse(request.body);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return reply.code(404).send({ message: "User not found" });
    }

    const valid = await bcrypt.compare(payload.currentPassword, user.passwordHash);
    if (!valid) {
      return reply.code(400).send({ message: "Current password is incorrect" });
    }

    const nextHash = await bcrypt.hash(payload.newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: nextHash }
    });

    return { ok: true };
  });

  app.post("/me/2fa/setup", { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = getAuthUser(request).userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return reply.code(404).send({ message: "User not found" });
    }

    const secret = generateTotpSecret();
    const otpauthUri = buildOtpAuthUri(user.email, env.twoFactorIssuer, secret);

    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorTempSecret: secret }
    });

    return { otpauthUri, secret };
  });

  app.post("/me/2fa/enable", { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = getAuthUser(request).userId;
    const payload = twoFactorVerifySchema.parse(request.body);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return reply.code(404).send({ message: "User not found" });
    }
    if (!user.twoFactorTempSecret) {
      return reply.code(400).send({ message: "2FA setup is not initialized" });
    }

    const ok = verifyTotpToken(user.twoFactorTempSecret, payload.otp);
    if (!ok) {
      return reply.code(400).send({ message: "Invalid 2FA code" });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: user.twoFactorTempSecret,
        twoFactorTempSecret: null
      }
    });

    return { ok: true };
  });

  app.post("/me/2fa/disable", { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = getAuthUser(request).userId;
    const payload = twoFactorVerifySchema.parse(request.body);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return reply.code(404).send({ message: "User not found" });
    }
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return reply.code(400).send({ message: "2FA is not enabled" });
    }

    const ok = verifyTotpToken(user.twoFactorSecret, payload.otp);
    if (!ok) {
      return reply.code(400).send({ message: "Invalid 2FA code" });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorTempSecret: null
      }
    });

    return { ok: true };
  });
}
