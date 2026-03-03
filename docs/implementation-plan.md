# BugHoi - Implementation Plan

## Current status
Version baseline: `v1.0.0`

## Progress tracker

### Phase 0 - Project Setup
Status: Completed
- Monorepo scaffold with `apps/web`, `apps/api`, `packages/shared`
- TypeScript + env setup + local run scripts

### Phase 1 - Data Layer + Auth
Status: Completed
- PostgreSQL + Prisma schema
- JWT login
- Owner bootstrap from `.env`
- Role model (`owner`, `admin`, `member`)
- Optional 2FA login flow (TOTP)

### Phase 2 - Goal Management
Status: Completed
- Goal CRUD by period (`weekly`, `monthly`, `quarterly`)
- Goal check-in with date constraints
- Progress calculation by check-in count
- Goal list sorting + pagination
- Quick Check-in short/expanded view

### Phase 3 - Task + Reminder Core
Status: Completed
- Task CRUD + complete
- Rich task model (category, description, reminder, repeat, tags, notification channel)
- Subtasks
- Task list filter/sort/pagination
- Quick Add short/expanded view

### Phase 4 - Dashboard + Analytics
Status: Completed (mobile-first baseline)
- Dashboard summary with grouped period progress
- Expand/collapse for Task and Goal progress groups
- Click-through from Dashboard item to target Task/Goal
- Analytics page with item/type/range selectors, chart/table/both

### Phase 5 - Profile + Preferences
Status: Completed
- Theme color selection + persistence
- Timezone selection
- Notification channels
- User self change password
- 2FA enable/disable with QR setup
- Notification + 2FA short/expanded sections

### Phase 6 - Admin Module
Status: Completed
- Embedded Admin User Management inside Profile (role-gated)
- Add/remove/deactivate user
- Role assignment
- Admin reset user password
- Master owner protection
- Admin section short/expanded view

### Phase 7 - n8n Integration
Status: In Progress
- Pending reminders endpoint + mark-sent endpoint available
- Weekly report automation endpoint pending final workflow polish

### Phase 8 - Deployment Pipeline
Status: Pending
- Docker production compose finalization
- GitHub Actions deploy-to-VPS workflow
- Rollback and health-check automation

### Phase 9 - Desktop View (new)
Status: Planned
- Add responsive desktop layouts for:
  - Dashboard
  - Tasks
  - Goals
  - Analytics
  - Profile/Admin
- Keep full action parity between mobile and desktop
- Add viewport QA matrix for sync validation

## Next task queue
1. Finalize desktop responsive layout system and page-by-page implementation.
2. Harden 2FA security (secret encryption at rest, OTP rate limiting, backup codes).
3. Finalize VPS deployment workflow and production configuration.
