# LivePlayHosts

A host management platform for LivePlay Mobile. Hosts can apply, manage their profiles, set availability, and complete training courses.

## Quick Commands

- **"giddyup"** - When the user says "giddyup", perform all three: push to git, deploy, and update CLAUDE.md with changes

## Development Standards

### Mobile-First Design (Required)

All new features MUST be optimized for mobile. Use these patterns:

- **Text**: Responsive sizes (`text-sm sm:text-base`, `text-xl sm:text-2xl`)
- **Padding**: Responsive spacing (`p-4 sm:p-6`, `gap-4 sm:gap-6`)
- **Grids**: Mobile-first breakpoints (`sm:grid-cols-2 lg:grid-cols-3`)
- **Tables**: Card view on mobile, table on desktop (`md:hidden` / `hidden md:block`)
- **Touch targets**: Minimum 44px tap targets on mobile
- **Layout**: Stack vertically on mobile, side-by-side on desktop

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Auth**: Clerk (`@clerk/nextjs`)
- **Database**: AWS DynamoDB
- **Storage**: AWS S3 (headshots, training videos)
- **Email**: Resend
- **Forms**: react-hook-form
- **Deployment**: AWS Amplify

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── training/           # User-facing training API
│   │   │   ├── courses/        # Course listing
│   │   │   ├── lessons/[id]/   # Lesson details
│   │   │   └── progress/       # Progress tracking
│   │   ├── admin/training/     # Admin training management API
│   │   │   ├── courses/        # Course CRUD
│   │   │   ├── sections/       # Section CRUD
│   │   │   └── lessons/        # Lesson CRUD
│   │   ├── schedule/           # User schedule API
│   │   │   └── widget/         # Dashboard widget data
│   │   ├── admin/impersonate/   # Ghost login (admin impersonation)
│   │   ├── admin/schedule/     # Admin schedule management
│   │   │   └── sync/           # Google Calendar sync
│   │   ├── hosts/              # Host management
│   │   ├── profile/            # User profile
│   │   ├── availability/       # Scheduling
│   │   └── upload-url/         # S3 presigned URLs
│   ├── admin/
│   │   ├── training/           # Admin training management UI
│   │   │   ├── courses/[id]/   # Course editor
│   │   │   │   └── lessons/[lessonId]/ # Lesson editor
│   │   │   └── courses/new/    # Create course
│   │   └── users/              # User management
│   ├── training/               # User-facing training
│   │   ├── courses/[courseId]/ # Course detail
│   │   └── lessons/[lessonId]/ # Lesson viewer
│   ├── schedule/               # User schedule page
│   ├── dashboard/
│   ├── directory/
│   ├── profile/
│   └── availability/
├── components/
│   ├── training/               # LMS components
│   │   ├── CourseCard.tsx
│   │   ├── CourseProgress.tsx
│   │   ├── LessonList.tsx
│   │   ├── VideoPlayer.tsx
│   │   └── ArticleContent.tsx
│   ├── ScheduleWidget.tsx      # Dashboard schedule widget
│   ├── ScheduleCalendar.tsx    # Full calendar view
│   ├── ImpersonationBanner.tsx # Ghost login amber banner
│   └── *.tsx
└── lib/
    ├── types.ts                # Core types
    ├── training-types.ts       # LMS types
    ├── schedule-types.ts       # Schedule types
    ├── scheduler-db.ts         # MySQL scheduler DB client
    ├── google-calendar.ts      # Google Calendar API
    ├── mock-schedule-data.ts   # Mock data for dev
    ├── host-utils.ts            # Shared host resolution + ghost login
    ├── roles.ts                # RBAC
    ├── dynamodb.ts             # DynamoDB client
    └── s3.ts                   # S3 client
```

## User Roles

Defined in `src/lib/types.ts`:
- `applicant` - New applicants
- `rejected` - Rejected applicants
- `host` - Approved hosts
- `producer` - Producers
- `talent` - Talent (admin access)
- `admin` - Administrators
- `owner` - Owners
- `finance` - Finance team
- `hr` - HR team

## LMS Feature Status

### Completed
- [x] Data models (Course, Section, Lesson, Quiz, FAQ, TrainingProgress)
- [x] User-facing training pages
  - Course listing with categories
  - Course detail with lesson navigation
  - Lesson viewer (video, article, quiz placeholder, FAQ)
  - Progress tracking with auto-save
  - Sequential course support
- [x] Admin training management
  - Course listing with stats
  - Create/edit/delete courses
  - Section management
  - Lesson editor with video upload
- [x] S3 video upload (training-videos folder)
- [x] DynamoDB tables created
- [x] Sample training data seeded

### TODO
- [ ] Quiz component and scoring
- [ ] FAQ page
- [ ] User progress dashboard
- [ ] Training analytics for admins
- [ ] Certificates on course completion

## Availability Feature

Users can set their work availability at `/availability`:
- **Weekly Schedule**: Check days available (Mon-Sun), set start/end times per day
- **Blocked Dates**: Add date ranges for vacations/time off with optional reason
- Data stored in `liveplayhosts-availability` table keyed by `hostId` (DynamoDB host.id)

### Data Architecture: host.id vs clerkUserId

All user data is keyed by `host.id` (DynamoDB UUID), not Clerk userId:
- **Authentication**: Clerk userId is used ONLY for auth, then looked up to get `host.id`
- **Data storage**: All tables use `host.id` as the VALUE (field name may be `userId` due to DynamoDB key constraints)
- **External integration**: Other systems can reference hosts by `host.id` without needing Clerk

**Tables using host.id as key value:**
- `liveplayhosts-availability` - `userId` field stores `host.id`
- `liveplayhosts-availability-changelog` - `userId` field stores `host.id`
- `liveplayhosts-callouts` - `userId` field stores `host.id`
- `liveplayhosts-training-progress` - `oduserId` field stores `host.id`

### Availability Change Log

Tracks when hosts (not admins) update their availability. Useful for auditing and producer awareness.

- **Admin Page**: `/admin/availability-changelog` - View all host availability changes
- **API**: `GET /api/admin/availability-changelog` - Paginated changelog with optional `hostId` filter
- **Table**: `liveplayhosts-availability-changelog`

Each log entry includes:
- Host name and email
- Change type: weekly schedule, time off, or both
- Before/after comparison for weekly changes
- Added/removed blocked date ranges
- Timestamp of change

**New Files:**
- `src/app/admin/availability-changelog/page.tsx`
- `src/app/api/admin/availability-changelog/route.ts`
- `scripts/create-availability-changelog-table.mjs`

## Schedule Integration (Aurora MySQL + Google Calendar)

Integrates with external Aurora MySQL scheduler database to display host schedules and sync to Google Calendar.

### Features
- **Dashboard Widget**: Shows next 5 upcoming shifts with studio, date, time (positioned top-left as most important)
- **Call Out**: Hosts can select shifts and submit a call out request (notifies producer)
- **Schedule Page**: Full calendar view with list/month toggle, color-coded by studio
- **Google Calendar Sync**: Admin-triggered sync to studio-based calendars, sends invites to hosts
- **Mock Data Mode**: Works without DB connection for development
- **Hourly Entries**: Schedules are tracked hourly - hosts move between rooms each hour

### Rooms (Studios)
- **Main Room** - Blue (#3B82F6)
- **Speed Bingo** - Green (#10B981)
- **Break** - Gray (#6B7280)

### User Pages
- `/schedule` - Full calendar view with month navigation
- Dashboard ScheduleWidget shows upcoming shifts

### API Routes
- `GET /api/schedule` - Get user's schedule for a month (params: year, month)
- `GET /api/schedule/widget` - Get upcoming schedule for dashboard widget
- `GET /api/admin/schedule/sync` - Check sync configuration status
- `POST /api/admin/schedule/sync` - Trigger Google Calendar sync (params: startDate, endDate)

### Host Mapping
User email from Clerk is matched to `talent.email` in MySQL to find their schedules.

### New Files
- `src/lib/schedule-types.ts` - Type definitions
- `src/lib/mock-schedule-data.ts` - Mock data for development
- `src/lib/scheduler-db.ts` - MySQL connection pool
- `src/lib/google-calendar.ts` - Google Calendar API client
- `src/components/ScheduleWidget.tsx` - Dashboard widget
- `src/components/ScheduleCalendar.tsx` - Full calendar view
- `src/app/schedule/page.tsx` - Schedule page
- `src/app/api/schedule/` - Schedule API routes
- `src/app/api/admin/schedule/sync/` - Admin sync route

### Environment Variables (Scheduler DB)
```
SCHEDULER_DB_HOST=<aurora-proxy-endpoint>
SCHEDULER_DB_NAME=<database-name>
SCHEDULER_DB_USER=<username>
SCHEDULER_DB_PASSWORD=<password>
```

### Environment Variables (Google Calendar)
```
GOOGLE_SERVICE_ACCOUNT_EMAIL=<service-account@project.iam.gserviceaccount.com>
GOOGLE_PRIVATE_KEY=<private-key-with-newlines>
GOOGLE_CALENDAR_MAIN_ROOM=<calendar-id>
GOOGLE_CALENDAR_SPEED_BINGO=<calendar-id>
GOOGLE_CALENDAR_BREAK=<calendar-id>
```

**Note:** For `GOOGLE_PRIVATE_KEY` in Amplify, paste the key exactly as it appears in the JSON file (with `\n` escaped newlines). The code handles converting `\n` to actual newlines.

### New Dependencies
- `googleapis` - Google Calendar API
- `mysql2` - MySQL client (moved to production deps)

## Call Out System

Hosts can request to call out from scheduled shifts. Admins can approve or deny requests.

### Features
- **Call Out Button**: Red button on Dashboard widget and Schedule page
- **Shift Selection**: Modal showing upcoming shifts with urgency indicators
- **Urgency Levels**: Emergency (<48h), Reschedule (<2wk), Good Notice (>2wk)
- **Status Tracking**: Pending, Approved, Denied statuses
- **Pending Badge**: "Call Out Pending" shown on schedule entries
- **Admin Management**: Review and approve/deny call out requests

### User Flow
1. User clicks "Call Out" button
2. Selects shifts from upcoming schedule (already-pending shifts are disabled)
3. Submits call out request
4. Sees "Call Out Pending" badge on those shifts
5. Admin reviews and approves/denies

### Admin Page
- `/admin/callouts` - View all call out requests
- Tabs: Pending, Approved, Denied, All
- Shows host name, shift details, urgency, submission time
- Approve/Deny buttons for pending requests
- Reset button to return to pending status

### API Routes
- `GET /api/callouts` - Get user's call outs (optional `?status=` filter)
- `POST /api/callouts` - Submit call out request
- `GET /api/admin/callouts` - List all call outs (admin)
- `PATCH /api/admin/callouts/[id]` - Update call out status (admin)
- `DELETE /api/admin/callouts/[id]` - Delete call out (admin)

### DynamoDB Table: `liveplayhosts-callouts`
- `id` (PK) - UUID
- `userId` - Clerk user ID
- `shiftId` - Schedule entry ID
- `shiftDate`, `shiftTime`, `studioName` - Shift details
- `status` - pending/approved/denied
- `createdAt`, `updatedAt` - Timestamps
- `reviewedBy`, `reviewedAt` - Admin review info
- GSI: `userId-createdAt-index`, `status-createdAt-index`, `shiftId-index`

## Ghost Login (Admin Impersonation)

Admins (admin/owner/talent) can view and interact with the app as any host. A secure httpOnly cookie (`lph_ghost_host_id`) stores the impersonated host's DynamoDB `host.id`.

### Features
- **View As button** on `/admin/users` for each active host (both mobile card and desktop table)
- **Amber banner** at top of every page showing "Viewing as **Name** (email) — Role" with Stop button
- **Full interaction** enabled (not read-only) — all pages/APIs resolve the impersonated host
- **Sidebar** shows impersonated host's role (hides admin nav during impersonation)
- **Audit logging** — `[GHOST START]` and `[GHOST STOP]` console logs with admin + host details

### Security
- Cookie: `httpOnly: true`, `secure` in production, `sameSite: "lax"`, `path: "/"`, `maxAge: 4 hours`
- Every request verifies the caller is an admin via Clerk before honoring the cookie
- Route protection (`requireRole="admin"`) always uses the **actual** admin role

### Architecture
- **`src/lib/host-utils.ts`** — Shared module with `getEffectiveHost()` and `getEffectiveHostWithEmailFallback()` that check the ghost cookie + admin role, then return the impersonated or real host
- All API routes and server component pages use these functions instead of local `getHostByClerkId` helpers

### API Routes
- `POST /api/admin/impersonate` — Start impersonation (body: `{ hostId }`)
- `GET /api/admin/impersonate` — Check current impersonation status
- `DELETE /api/admin/impersonate` — Stop impersonation (clears cookie)

### Flow
1. Admin clicks "View As" on `/admin/users` → POST sets cookie → redirect to `/dashboard`
2. All pages/APIs call `getEffectiveHost()` which returns impersonated host data
3. Admin clicks "Stop Viewing" → DELETE clears cookie → redirect to `/admin/users`

## Broadcast Messaging System

Multi-channel broadcast system for admins to send targeted messages to hosts.

### Features
- **Channels**: Slack DM (full body), Email (formatted HTML), SMS (short + link)
- **User Selection**: 3-column selector with role/location filters, available users, and selected users
  - Filter by roles and locations (grouped by US/International)
  - Add individual users or all filtered users
  - Remove individual users or all selected
  - Save selections as part of templates
- **Scheduling**: Send immediately or schedule for later
- **Templates**: Reusable message templates with saved user selections
- **Video attachments**: Upload videos to S3, served via presigned URLs (7-day expiration)
- **Image support**: Paste, drag-drop, or upload images in message body (stored in S3)
- **Message Center**: Users can view all messages on dashboard
- **Delivery tracking**: Track Slack/Email/SMS delivery status and read receipts
- **Rate limiting**: Max 50 broadcasts per day per user
- **Sender attribution**: "Sent by [name]" footer in Slack and Email messages

### Admin Pages
- `/admin/broadcasts` - List all broadcasts
- `/admin/broadcasts/new` - Create new broadcast
- `/admin/broadcasts/[id]` - Edit/view broadcast details
- `/admin/templates` - Manage reusable templates

### User Pages
- `/messages` - User message inbox
- `/messages/[id]` - View message details
- Dashboard MessageCenter widget shows recent messages

### API Routes
- `GET/POST /api/admin/broadcasts` - List/create broadcasts
- `GET/PUT/DELETE /api/admin/broadcasts/[id]` - Broadcast CRUD
- `POST /api/admin/broadcasts/[id]/send` - Send/schedule broadcast
- `GET /api/admin/broadcasts/[id]/deliveries` - Delivery details
- `GET/POST /api/admin/templates` - Template CRUD
- `GET /api/messages` - User's messages
- `POST /api/messages/[id]/read` - Mark as read
- `GET /api/messages/unread-count` - Unread count
- `GET/POST /api/cron/send-broadcasts` - Process scheduled sends

### New Environment Variables
- `SLACK_BOT_TOKEN` - Slack bot token for DMs (**Important:** In Amplify, set branch to "main", not "All branches")
- `CRON_SECRET` - Auth secret for cron endpoint
- `TWILIO_ACCOUNT_SID` - Twilio account SID for SMS
- `TWILIO_AUTH_TOKEN` - Twilio auth token for SMS
- `TWILIO_PHONE_NUMBER` - Twilio phone number (E.164 format, e.g., +1XXXXXXXXXX)

### New Dependencies
- `@slack/web-api` - Slack messaging
- `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link` - WYSIWYG editor
- `twilio` - SMS via Twilio

## DynamoDB Tables

- `liveplayhosts-hosts`
- `liveplayhosts-availability` (userId → weekly schedule + blocked dates)
- `liveplayhosts-courses`
- `liveplayhosts-sections`
- `liveplayhosts-lessons`
- `liveplayhosts-quizzes`
- `liveplayhosts-faqs`
- `liveplayhosts-training-progress`
- `liveplayhosts-quiz-attempts`
- `liveplayhosts-broadcasts` (main broadcast messages)
- `liveplayhosts-broadcast-templates` (reusable templates)
- `liveplayhosts-broadcast-deliveries` (per-user delivery tracking)
- `liveplayhosts-locations` (location tags for users)
- `liveplayhosts-callouts` (call out requests with status tracking)
- `liveplayhosts-availability-changelog` (host availability change audit log)

## Scripts

```bash
npm run dev                               # Start dev server
npm run build                             # Production build
npm run lint                              # Run ESLint
node scripts/create-training-tables.mjs  # Create training DynamoDB tables
node scripts/create-broadcast-tables.mjs # Create broadcast DynamoDB tables
node scripts/create-locations-table.mjs  # Create locations table with seed data
node scripts/create-callouts-table.mjs   # Create call outs table
node scripts/migrate-to-hostid.mjs       # Migrate data from userId to hostId (run after deploy)
node scripts/create-availability-changelog-table.mjs # Create availability changelog table
node scripts/seed-training-data.mjs      # Seed sample courses
```

## Environment Variables

See `.env.example` for required variables:
- Clerk keys (NEXT_PUBLIC_CLERK_*, CLERK_SECRET_KEY)
- AWS credentials (S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_REGION)
- S3 bucket config

## Deployment Log

| Date | Commit | Description |
|------|--------|-------------|
| 2026-01-28 | pending | Add urgency warnings to call out confirmation (48h emergency, 2wk notice) |
| 2026-01-28 | 03953bf | Add ghost login: admin impersonation with cookie-based host switching |
| 2026-01-27 | 12f0013 | Refactor: use host.id for all user data, Clerk ID for auth only (migration complete) |
| 2026-01-27 | 0562606 | Add host availability change log (tracks when hosts update their avails) |
| 2026-01-27 | 8c411e7 | Add admin host availability page with view/edit, bulk update script |
| 2026-01-27 | 9916340 | Add host scheduling priority admin page (high/medium/low, admin-only) |
| 2026-01-27 | 785aaa6 | Optimize Schedule page header for mobile (Call Out button visible) |
| 2026-01-27 | cd6dc9a | Fix: typo odUserId -> userId in callouts API |
| 2026-01-27 | 0d57821 | Fix: use crypto.randomUUID instead of uuid package |
| 2026-01-27 | 927acc9 | Fix admin callouts page: remove duplicate AuthenticatedLayout |
| 2026-01-27 | 5225dca | Add admin Call Outs page for managing call out requests |
| 2026-01-27 | f112d91 | Add call out tracking with DynamoDB, show "Call Out Pending" on schedule |
| 2026-01-27 | 5b7f34b | Add urgency icons to Call Out modal (emergency <48h, reschedule <2wk, green >2wk) |
| 2026-01-27 | be90261 | Add Call Out button to My Schedule page |
| 2026-01-26 | 8d4e887 | Add Call Out button with shift selection modal, move schedule widget to top-left |
| 2026-01-26 | 42c5baf | Simplify rooms to Main Room, Speed Bingo, and Break |
| 2026-01-26 | beb815f | Update mock schedule data: hourly entries with room switching and breaks |
| 2026-01-26 | c37e805 | Add schedule integration with Aurora MySQL and Google Calendar sync |
| 2026-01-26 | a07e07a | Switch SMS from AWS SNS to Twilio |
| 2026-01-26 | c1ee5a2 | Auto-populate SMS text from subject in broadcast form |
| 2026-01-26 | 95cbf3a | Add auto-save to availability form (removes save button) |
| 2026-01-26 | ea49f74 | Add PWA icons for home screen installation |
| 2026-01-26 | 486ffdd | Optimize training pages for mobile (responsive text, padding, grids) |
| 2026-01-26 | 17666f3 | Optimize messages and dashboard pages for mobile (responsive padding, text, grids) |
| 2026-01-26 | 8d2a10d | Optimize profile form for mobile (responsive grids, smaller media) |
| 2026-01-26 | 80345b1 | Redesign availability page for mobile (compact schedule, stacked forms) |
| 2026-01-26 | ef91f64 | Add mobile card views to admin pages (users, broadcasts, training) |
| 2026-01-26 | 0c0c395 | Add PWA support and mobile-responsive directory (card view on mobile) |
| 2026-01-26 | 0f5183d | Fix mobile header: show login and apply buttons on all screen sizes |
| 2026-01-26 | 03128c8 | Add comprehensive developer documentation (DEVELOPER.md) |
| 2026-01-25 | d0744ba | Add 'Resend as New' button to duplicate sent broadcasts |
| 2026-01-25 | 85eb978 | Fix broadcast detail page: use useParams() instead of use(params) |
| 2026-01-25 | 54165f7 | Fix broadcasts page: defensive null checks, robust error handling |
| 2026-01-25 | 246e187 | Fix broadcasts page crash: handle undefined targetRoles, show user count |
| 2026-01-25 | 2685197 | Add Sent By column to broadcasts list, fix preview for sent messages (presigned URLs) |
| 2026-01-25 | 661bfb2 | Fix application email: correct from address, add applicant confirmation email |
| 2026-01-25 | f0799df | Add user counts to tabs, red badge for applicants in admin pages |
| 2026-01-25 | bfaa509 | Fix messages not appearing: auth fix, presigned URLs, sidebar layout |
| 2026-01-25 | dad45b0 | Make UserSelector collapsible - starts compact, expands on click |
| 2026-01-25 | 844288a | Fix email images (HTML-encode presigned URLs) and template saving (bodySms now optional) |
| 2026-01-25 | dca0903 | Reorganize broadcast page: sequential layout, preview/actions at bottom, Save as Template |
| 2026-01-25 | bf69312 | Add image paste/upload support, fix rich text formatting (typography plugin) |
| 2026-01-25 | bddd81c | Fix S3 video access: generate presigned URLs (7-day expiration) for broadcasts |
| 2026-01-25 | 2d06b7f | Fix video in Slack: use Watch Video button instead of unsupported video block |
| 2026-01-25 | 8d0303a | Fix sender name lookup to check clerkUserId |
| 2026-01-25 | 283a7fa | Add "Sent by [name]" footer to Slack and Email broadcasts |
| 2026-01-25 | 9ab56dc | Fix Slack invalid_blocks error, clean up debug code (Amplify env var must use branch=main) |
| 2026-01-23 | 1f123e3 | Fix Slack button block, increase rate limit to 50/day, add debug scripts |
| 2026-01-23 | c84419f | Add comprehensive logging for broadcast channel delivery |
| 2026-01-23 | 263e4a7 | Fix: Send route now checks targetUserIds (was only checking targetRoles) |
| 2026-01-23 | 120d89a | Add better error logging for broadcast targeting debug |
| 2026-01-23 | f66dbca | Fix: SMS optional, use host's Slack IDs directly (no cross-user lookup) |
| 2026-01-23 | b19127c | Add Host Producer Channel option to send to host's prod Slack ID |
| 2026-01-23 | b249c92 | Move delivery channels to top, add clickable US/International region filters |
| 2026-01-23 | c425c82 | Add 3-column user selection for broadcasts with role/location filters |
| 2026-01-23 | cdb2b1b | Update header: larger logo, add Host Login button |
| 2026-01-23 | d412387 | Rebrand to LivePlay (one word) across the site |
| 2026-01-23 | fb490f3 | Security hardening: XSS fix, CORS restriction, security headers, auth on uploads |
