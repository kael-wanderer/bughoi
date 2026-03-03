import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getAuthUser } from "../lib/auth-user.js";
import { requireAdmin } from "../lib/rbac.js";

const createUserSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1),
  password: z.string().min(8),
  roles: z.array(z.enum(["owner", "admin", "member"])).default(["member"]),
  active: z.boolean().default(true)
});

const updateRolesSchema = z.object({
  roles: z.array(z.enum(["owner", "admin", "member"]))
});

const updateStatusSchema = z.object({
  active: z.boolean()
});

const updatePasswordSchema = z.object({
  password: z.string().min(8)
});

async function upsertRoleIds(roleNames: string[]) {
  const ids: string[] = [];
  for (const name of roleNames) {
    const role = await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name }
    });
    ids.push(role.id);
  }
  return ids;
}

export async function adminRoutes(app: FastifyInstance) {
  app.post("/admin/users", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!(await requireAdmin(request, reply))) {
      return;
    }

    const payload = createUserSchema.parse(request.body);
    const normalizedEmail = payload.email.trim().toLowerCase();
    const existing = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } }
    });
    if (existing) {
      return reply.code(409).send({ message: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(payload.password, 10);
    const roleIds = await upsertRoleIds(payload.roles);

    const created = await prisma.$transaction(async (tx: any) => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          displayName: payload.displayName,
          passwordHash,
          active: payload.active
        }
      });

      if (roleIds.length > 0) {
        await tx.userRole.createMany({
          data: roleIds.map((roleId: string) => ({ userId: user.id, roleId }))
        });
      }

      return tx.user.findUnique({
        where: { id: user.id },
        include: { roles: { include: { role: true } } }
      });
    });

    if (!created) {
      return reply.code(500).send({ message: "Failed to create user" });
    }

    return {
      id: created.id,
      email: created.email,
      displayName: created.displayName,
      isMasterOwner: created.isMasterOwner,
      active: created.active,
      timezone: created.timezone,
      roles: created.roles.map((r: any) => r.role.name)
    };
  });

  app.get("/admin/users", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!(await requireAdmin(request, reply))) {
      return;
    }

    const users = await prisma.user.findMany({
      include: { roles: { include: { role: true } } },
      orderBy: { createdAt: "asc" }
    });

    return users.map((user: any) => ({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      isMasterOwner: user.isMasterOwner,
      active: user.active,
      timezone: user.timezone,
      roles: user.roles.map((r: any) => r.role.name)
    }));
  });

  app.patch("/admin/users/:id/roles", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!(await requireAdmin(request, reply))) {
      return;
    }

    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const payload = updateRolesSchema.parse(request.body);

    const user = await prisma.user.findUnique({ where: { id: params.id } });
    if (!user) {
      return reply.code(404).send({ message: "User not found" });
    }
    if (user.isMasterOwner && !payload.roles.includes("owner")) {
      return reply.code(400).send({ message: "Master owner must keep owner role" });
    }

    const roleIds = await upsertRoleIds(payload.roles);

    await prisma.$transaction(async (tx: any) => {
      await tx.userRole.deleteMany({ where: { userId: params.id } });
      if (roleIds.length > 0) {
        await tx.userRole.createMany({
          data: roleIds.map((roleId: string) => ({ userId: params.id, roleId }))
        });
      }
    });

    return { ok: true };
  });

  app.patch("/admin/users/:id/status", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!(await requireAdmin(request, reply))) {
      return;
    }

    const authUser = getAuthUser(request);
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const payload = updateStatusSchema.parse(request.body);

    if (authUser.userId === params.id && !payload.active) {
      return reply.code(400).send({ message: "You cannot deactivate your own account" });
    }

    const user = await prisma.user.findUnique({ where: { id: params.id } });
    if (!user) {
      return reply.code(404).send({ message: "User not found" });
    }
    if (user.isMasterOwner && !payload.active) {
      return reply.code(400).send({ message: "Master owner cannot be deactivated" });
    }

    const updated = await prisma.user.update({
      where: { id: params.id },
      data: { active: payload.active },
      select: { id: true, active: true }
    });

    return updated;
  });

  app.delete("/admin/users/:id", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!(await requireAdmin(request, reply))) {
      return;
    }

    const authUser = getAuthUser(request);
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    if (authUser.userId === params.id) {
      return reply.code(400).send({ message: "You cannot remove your own account" });
    }

    const user = await prisma.user.findUnique({
      where: { id: params.id },
      include: { roles: { include: { role: true } } }
    });
    if (!user) {
      return reply.code(404).send({ message: "User not found" });
    }
    if (user.isMasterOwner) {
      return reply.code(400).send({ message: "Master owner cannot be removed" });
    }

    const isOwner = user.roles.some((r: any) => r.role.name === "owner");
    if (isOwner) {
      const remainingOwnerCount = await prisma.userRole.count({
        where: {
          role: { name: "owner" },
          userId: { not: params.id }
        }
      });
      if (remainingOwnerCount < 1) {
        return reply.code(400).send({ message: "Cannot remove the last owner account" });
      }
    }

    await prisma.user.delete({ where: { id: params.id } });
    return { ok: true };
  });

  app.patch("/admin/users/:id/password", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!(await requireAdmin(request, reply))) {
      return;
    }

    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const payload = updatePasswordSchema.parse(request.body);
    const user = await prisma.user.findUnique({ where: { id: params.id } });
    if (!user) {
      return reply.code(404).send({ message: "User not found" });
    }

    const passwordHash = await bcrypt.hash(payload.password, 10);
    await prisma.user.update({
      where: { id: params.id },
      data: { passwordHash, active: true }
    });
    return { ok: true };
  });
}
