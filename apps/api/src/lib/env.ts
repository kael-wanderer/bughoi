import "./load-env.js";

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.API_PORT ?? 9001),
  databaseUrl: process.env.DATABASE_URL ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "change_me",
  n8nApiToken: process.env.N8N_API_TOKEN ?? "change_me",
  ownerEmail: process.env.OWNER_EMAIL?.trim() ?? "",
  ownerPassword: process.env.OWNER_PASSWORD ?? "",
  ownerDisplayName: process.env.OWNER_DISPLAY_NAME?.trim() ?? "Owner",
  twoFactorIssuer: process.env.TWO_FACTOR_ISSUER?.trim() ?? "BugHoi"
};
