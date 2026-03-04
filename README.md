# BugHoi - Personal Task Tracking App

Monorepo with mobile-first web app, REST API, PostgreSQL schema, and infra for Docker deployment.

## Apps
- `apps/web`: Next.js frontend (iPhone-first)
- `apps/api`: Fastify REST API + Prisma
- `packages/shared`: shared Zod schemas/types

## Local setup
1. `cp .env.example .env`
2. `npm install`
3. Start Postgres (Docker or local)
4. `npm run db:generate`
5. `npm run db:migrate`
6. `npm run dev`

## API base
- `http://localhost:9001`

## Web base
- `http://localhost:9000`

## Production notes
- Keep `/opt/bughoi/.env` on VPS. The deploy workflow requires it and will fail fast if missing.
- Deploy pipeline now runs `prisma db push` automatically before starting API/Web, so missing tables do not break startup.
- Recommended Caddy routing on one domain:
  - `bughoi.your-domain.com` -> `bughoi-web:3000`
  - `bughoi.your-domain.com/api/*` -> `bughoi-api:4000`
- Set `NEXT_PUBLIC_API_URL=https://bughoi.your-domain.com/api` in VPS `.env`.
