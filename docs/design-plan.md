# BugHoi - Design Plan

## 1. Product Scope

### Core features
- Goal tracking by period: `weekly`, `monthly`, `quarterly`
- Task tracking with due date, status, priority, reminders
- Dashboard with progress and pending items
- Analytics for completion trends and consistency
- Profile settings (theme, timezone, notification channels)
- Admin for user and role management
- Optional 2FA (TOTP) for account login security

### Primary target
- Mobile-first on iPhone (Safari + Add to Home Screen PWA)
- Desktop-ready responsive view as secondary target (work in progress)

## 2. UX Direction (based on `frontend_sampel`)

Use your existing sample screens as the visual base:
- Keep orange accent (`#ec5b13`), rounded cards, bottom nav pattern
- Keep screen structure in:
  - `/frontend_sampel/goals_progress`
  - `/frontend_sampel/task_tracking`
  - `/frontend_sampel/dashboard`
  - `/frontend_sampel/analytics`
  - `/frontend_sampel/profile_settings`
  - `/frontend_sampel/mobile_user_role_management`

Mobile layout rules:
- Width-first design for `390x844` (iPhone 12/13/14), support down to `375px`
- Sticky header + sticky bottom nav with safe-area padding (`env(safe-area-inset-bottom)`)
- Touch targets >= `44px`
- Use segmented controls for Weekly/Monthly/Quarterly filters

Desktop layout direction:
- Keep same data/actions as mobile (no feature drift)
- Use wider content grid with separated list/filter/form panels
- Replace small mobile cards with denser table/list blocks where useful
- Keep mobile and desktop behavior synchronized through shared API/state

Cross-view sync rules:
- One API contract for both views
- One source of truth for domain logic (progress, filters, statuses)
- Feature parity checklist required for each new feature

## 3. Recommended Architecture

Monorepo:
- `apps/web`: Next.js (App Router), TypeScript, Tailwind
- `apps/api`: Node.js Fastify (or NestJS), TypeScript
- `packages/shared`: shared types/validation schemas

Data + infra:
- PostgreSQL (main DB)
- Redis (optional but recommended for queues/cache)
- Docker Compose on VPS
- Caddy as reverse proxy (already present)

Why this fits:
- Fast mobile UI iteration from your existing HTML samples
- Stable REST API for app + n8n workflows
- Easy Docker deployment into your current VPS stack
- Enables responsive UI variants (mobile/desktop) without splitting codebase

## 4. Domain Model (DB)

Main tables:
- `users` (id, email, password_hash, display_name, timezone, theme, status)
- `roles` (id, name: owner/admin/member)
- `user_roles` (user_id, role_id)
- `goals` (id, user_id, title, category, period_type, period_start, period_end, target_value, unit, status)
- `goal_checkins` (id, goal_id, checkin_date, value, note)
- `tasks` (id, user_id, goal_id nullable, title, description, due_at, priority, status, completed_at)
- `task_reminders` (id, task_id, remind_at, channel, sent_at, status)
- `notification_channels` (id, user_id, type: email/telegram/webpush, config_json, enabled)
- `activity_events` (id, user_id, entity_type, entity_id, action, metadata_json, created_at)
- `api_clients` (id, name, token_hash, scopes, active) for n8n auth

Indexes:
- `tasks(user_id, status, due_at)`
- `goals(user_id, period_type, period_start, period_end)`
- `task_reminders(remind_at, status)`

## 5. API Design (for web + n8n)

Auth:
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`

Goals:
- `GET /goals?period=weekly|monthly|quarterly`
- `POST /goals`
- `PATCH /goals/:id`
- `POST /goals/:id/checkins`

Tasks:
- `GET /tasks?status=active|completed|overdue`
- `POST /tasks`
- `PATCH /tasks/:id`
- `POST /tasks/:id/complete`
- `POST /tasks/:id/reminders`

Dashboard & analytics:
- `GET /dashboard/summary?period=weekly|monthly|quarterly`
- `GET /analytics/progress?from=...&to=...`
- `GET /analytics/streaks`

Profile/admin:
- `GET /me`
- `PATCH /me/preferences`
- `GET /admin/users`
- `PATCH /admin/users/:id/roles`

n8n integration endpoints:
- `GET /integrations/n8n/reminders/pending?before=ISO_DATE`
- `POST /integrations/n8n/reminders/:id/mark-sent`
- `POST /integrations/n8n/reports/weekly`

Security:
- JWT for user sessions
- API token (scope-limited) for n8n endpoints

## 6. n8n Workflow Design

Workflow A: Reminder Sender
- Trigger: Cron every 5 minutes
- Step 1: GET pending reminders from API
- Step 2: Send email/Telegram/Webhook message
- Step 3: Mark reminder as sent via API

Workflow B: Weekly Report Generator
- Trigger: weekly schedule (e.g., Monday 08:00 local timezone)
- Step 1: GET analytics summary
- Step 2: Generate message/HTML report
- Step 3: Send to email/Telegram
- Step 4: Store report run status

Workflow C: Escalation
- Trigger: overdue tasks query daily
- Step 1: fetch overdue tasks
- Step 2: send grouped alert

## 7. Deployment Design

Containers on VPS (same compose project family as n8n):
- `web` (Next.js)
- `api` (Fastify/Nest)
- `postgres`
- `redis` (optional)
- `caddy` (existing reverse proxy)

Routing (example):
- `app.yourdomain.com` -> `web:3000`
- `api.yourdomain.com` -> `api:4000`
- `n8n.yourdomain.com` -> existing n8n service

GitHub Actions:
- Build/test
- Build Docker images
- Push images to GHCR
- SSH to VPS: `docker compose pull && docker compose up -d`

## 8. Quality & Security Baseline

- Validation with Zod (request/response)
- RBAC checks on admin routes
- Rate limiting on auth + integrations
- Audit log for admin actions
- Backup: daily Postgres dump + retention policy
- Monitoring: uptime + API error logs + n8n execution failures
