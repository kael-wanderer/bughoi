# BugHoi - Version Tracking

## v1.1.0

Release date: 2026-03-03
Type: Responsive Desktop & Deployment Upgrade

### Product enhancement delivered

- **Responsive Desktop Layout**: Fully optimized two-column layouts for larger viewports with persistent navigation.
- **CI/CD Pipeline**: Automated deployment to VPS via GitHub Actions and Docker.

### Features delivered

#### Desktop Optimization

- **Persistent Sidebar Navigation**: Left-aligned navigation bar for desktop users with active link indicators.
- **Responsive Grid System**:
  - **Dashboard**: Multi-column responsive grid layout.
  - **Tasks/Goals**: Two-column layout with **sticky forms** for better productivity.
  - **Analytics**: Side-by-side view for filters and data visualization.
- **Sticky Elements**: Search filters and creation forms stay pinned while scrolling long lists.
- **Premium UI Polish**: Improved typography, layered shadows, and micro-interactions.

#### Security & Authentication

- **Command Center Login**: Premium, centered desktop login interface with improved feedback states.
- **Admin Mission Control**: Enhanced user management page with a responsive grid and status indicators.
- **Owner Bootstrap**: Verified master owner creation via environment variables (`OWNER_EMAIL`, `OWNER_PASSWORD`).

#### Infrastructure & Deployment

- **GitHub Actions Workflow**: Automated build and deployment over SSH with encrypted port and passphrase support.
- **Docker Compose Updates**:
  - Port mapping (3000/4000) for host-level reverse proxies like Caddy.
  - Customizable database naming (`POSTGRES_DB=bughoi`).
- **Deployment Script**: Robust initialization script handling existing `.env` files and Docker image pruning.

---

## v1.0.0

Release date: 2026-03-03
Type: Initial functional release (mobile-first web app)

### Product scope delivered

- Personal task tracking app with goal management and reminders
- Multi-user support with roles (`owner`, `admin`, `member/user`)
- Mobile-first UI for iPhone, accessible from local network and desktop browser

### Features delivered

#### Authentication & security

- Login with JWT
- Optional TOTP 2FA flow:
  - 2FA setup in Profile
  - QR + secret for Authy/Authenticator
  - OTP step after password login for 2FA-enabled users
- Owner bootstrap from environment (`OWNER_EMAIL`, `OWNER_PASSWORD`, `OWNER_DISPLAY_NAME`)
- Master owner protection in admin actions

#### Goals

- Goal tracking by period: `weekly`, `monthly`, `quarterly`
- Goal create/edit/delete
- Quick check-in with date validation (last 60 days, no future)
- Progress based on check-in count
- Goal list sorting + pagination (3 items/page)
- Collapsible Quick Check-in (short view / expanded view)

#### Tasks

- Task create/edit/delete/complete
- Rich task fields: category, description, priority, reminder preset/custom, repeat/end-repeat, tags, notification channel
- Subtasks support (same task template)
- Notification option includes `off`, `email`, `telegram`, `all`
- Task filtering (`all`, `active`, `completed`, `overdue`)
- Sorting by name/deadline + ASC/DESC
- Pagination (3 items/page)
- Collapsible Quick Add (short view / expanded view)

#### Dashboard

- Task summary + goal summary
- Progress grouped by `weekly`, `monthly`, `quarterly`
- Expandable period cards for Task and Goal
- Item click-through links:
  - dashboard task -> task detail highlight in Tasks page
  - dashboard goal -> goal highlight in Goals page

#### Analytics

- Select item: `goal` / `task`
- Select view type: `chart` / `table` / `both`
- Time range: `weekly` / `monthly` / `quarterly` / `custom`
- Summary cards and activity chart

#### Profile & admin

- Theme color selector (`orange`, `gray`, `green`) with persistence
- Time zone selector
- Notification settings (collapsible short/expanded)
- User self change password
- 2FA settings (collapsible short/expanded)
- Admin user management embedded in Profile (role-gated), with:
  - add user
  - change role
  - activate/deactivate
  - reset password
  - remove user
  - collapsible short/expanded section

### Notes

- Branding updated to `BugHoi`
- Current UX is mobile-first; desktop-optimized layout is planned as next milestone
