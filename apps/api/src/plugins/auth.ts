import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../lib/env.js";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyJWT {
    payload: { userId: string; email: string; mfaPending?: boolean };
    user: { userId: string; email: string; mfaPending?: boolean };
  }
}

export default fp(async (app) => {
  await app.register(jwt, {
    secret: env.jwtSecret,
    sign: { expiresIn: "8h" }
  });

  app.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
      if ((request.user as { mfaPending?: boolean }).mfaPending) {
        return reply.code(401).send({ message: "2FA verification required" });
      }
    } catch {
      return reply.code(401).send({ message: "Unauthorized" });
    }
  });
});
