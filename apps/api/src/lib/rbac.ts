import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "./prisma.js";
import { getAuthUser } from "./auth-user.js";

export async function getUserRoles(request: FastifyRequest): Promise<string[]> {
  const userId = getAuthUser(request).userId;
  const roles = await prisma.userRole.findMany({
    where: { userId },
    include: { role: true }
  });
  return roles.map((r) => r.role.name);
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  const roles = await getUserRoles(request);
  if (!roles.includes("owner") && !roles.includes("admin")) {
    reply.code(403).send({ message: "Admin access required" });
    return false;
  }
  return true;
}
