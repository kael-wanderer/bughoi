import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { verifyTotpToken } from "../lib/totp.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const login2faSchema = z.object({
  mfaToken: z.string().min(1),
  otp: z.string().regex(/^\d{6}$/)
});

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/login", async (request, reply) => {
    const payload = loginSchema.parse(request.body);
    const email = payload.email.trim();
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } }
    });
    if (!user) {
      return reply.code(401).send({ message: "Invalid credentials" });
    }
    if (!user.active) {
      return reply.code(403).send({ message: "User is inactive" });
    }

    const valid = await bcrypt.compare(payload.password, user.passwordHash);
    if (!valid) {
      return reply.code(401).send({ message: "Invalid credentials" });
    }

    if (user.twoFactorEnabled) {
      const mfaToken = await reply.jwtSign(
        { userId: user.id, email: user.email, mfaPending: true },
        { expiresIn: "5m" }
      );
      return { requires2fa: true, mfaToken };
    }

    const token = await reply.jwtSign({ userId: user.id, email: user.email });

    return { token, user: { id: user.id, email: user.email, displayName: user.displayName } };
  });

  app.post("/auth/login/2fa", async (request, reply) => {
    const payload = login2faSchema.parse(request.body);

    let decoded: { userId: string; email: string; mfaPending?: boolean };
    try {
      decoded = app.jwt.verify(payload.mfaToken) as { userId: string; email: string; mfaPending?: boolean };
    } catch {
      return reply.code(401).send({ message: "Invalid or expired 2FA session" });
    }

    if (!decoded.mfaPending) {
      return reply.code(400).send({ message: "Invalid 2FA session" });
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || !user.active) {
      return reply.code(401).send({ message: "Invalid credentials" });
    }
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return reply.code(400).send({ message: "2FA is not enabled for this account" });
    }

    const ok = verifyTotpToken(user.twoFactorSecret, payload.otp);
    if (!ok) {
      return reply.code(401).send({ message: "Invalid 2FA code" });
    }

    const token = await reply.jwtSign({ userId: user.id, email: user.email });
    return { token, user: { id: user.id, email: user.email, displayName: user.displayName } };
  });
}
