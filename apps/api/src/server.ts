import Fastify from "fastify";
import cors from "@fastify/cors";
import authPlugin from "./plugins/auth.js";
import { authRoutes } from "./routes/auth.js";
import { goalRoutes } from "./routes/goals.js";
import { taskRoutes } from "./routes/tasks.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { integrationRoutes } from "./routes/integrations.js";
import { profileRoutes } from "./routes/profile.js";
import { adminRoutes } from "./routes/admin.js";
import { env } from "./lib/env.js";
import { ensureOwnerFromEnv } from "./lib/bootstrap-owner.js";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: true,
  credentials: true
});

await app.register(authPlugin);
await ensureOwnerFromEnv(app.log);

app.get("/health", async () => ({ status: "ok", date: new Date().toISOString() }));

await app.register(authRoutes);
await app.register(goalRoutes);
await app.register(taskRoutes);
await app.register(dashboardRoutes);
await app.register(profileRoutes);
await app.register(adminRoutes);
await app.register(integrationRoutes);

app.setErrorHandler((error, _request, reply) => {
  if ((error as { issues?: unknown }).issues) {
    return reply.code(400).send({ message: "Validation failed", details: (error as { issues: unknown }).issues });
  }

  app.log.error(error);
  return reply.code(500).send({ message: "Internal server error" });
});

app.listen({ port: env.port, host: "0.0.0.0" }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
