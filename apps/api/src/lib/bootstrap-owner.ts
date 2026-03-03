import bcrypt from "bcryptjs";
import type { FastifyBaseLogger } from "fastify";
import { prisma } from "./prisma.js";
import { env } from "./env.js";

export async function ensureOwnerFromEnv(log: FastifyBaseLogger) {
  if (!env.ownerEmail || !env.ownerPassword) {
    log.warn("OWNER_EMAIL/OWNER_PASSWORD not set. Owner bootstrap skipped.");
    return;
  }

  if (env.ownerPassword.length < 8) {
    throw new Error("OWNER_PASSWORD must be at least 8 characters");
  }

  const email = env.ownerEmail.toLowerCase();
  const passwordHash = await bcrypt.hash(env.ownerPassword, 10);

  const user = await prisma.$transaction(async (tx) => {
    const ownerRole = await tx.role.upsert({
      where: { name: "owner" },
      update: {},
      create: { name: "owner" }
    });

    await tx.user.updateMany({
      where: { isMasterOwner: true, email: { not: email } },
      data: { isMasterOwner: false }
    });

    const ownerUser = await tx.user.upsert({
      where: { email },
      update: {
        displayName: env.ownerDisplayName,
        passwordHash,
        active: true,
        isMasterOwner: true
      },
      create: {
        email,
        displayName: env.ownerDisplayName,
        passwordHash,
        active: true,
        isMasterOwner: true
      }
    });

    await tx.userRole.upsert({
      where: {
        userId_roleId: {
          userId: ownerUser.id,
          roleId: ownerRole.id
        }
      },
      update: {},
      create: {
        userId: ownerUser.id,
        roleId: ownerRole.id
      }
    });

    return ownerUser;
  });

  log.info({ email }, "Owner account ensured from env");
}
