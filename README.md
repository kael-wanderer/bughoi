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
