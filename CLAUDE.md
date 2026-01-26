# LivePlayHosts

A host management platform for LivePlay Mobile. Hosts can apply, manage their profiles, set availability, and complete training courses.

## Quick Commands

- **"giddyup"** - When the user says "giddyup", perform all three: push to git, deploy, and update CLAUDE.md with changes

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
│   └── *.tsx
└── lib/
    ├── types.ts                # Core types
    ├── training-types.ts       # LMS types
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
- Data stored in `liveplayhosts-availability` table keyed by Clerk userId

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

### New Dependencies
- `@slack/web-api` - Slack messaging
- `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link` - WYSIWYG editor
- `@aws-sdk/client-sns` - SMS via AWS SNS

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

## Scripts

```bash
npm run dev                               # Start dev server
npm run build                             # Production build
npm run lint                              # Run ESLint
node scripts/create-training-tables.mjs  # Create training DynamoDB tables
node scripts/create-broadcast-tables.mjs # Create broadcast DynamoDB tables
node scripts/create-locations-table.mjs  # Create locations table with seed data
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
| 2026-01-26 | 8d2a10d | Optimize profile form for mobile (responsive grids, smaller media) |
| 2026-01-26 | 80345b1 | Redesign availability page for mobile (compact schedule, stacked forms) |
| 2026-01-26 | ef91f64 | Add mobile card views to admin pages (users, broadcasts, training) |
| 2026-01-26 | 0c0c395 | Add PWA support and mobile-responsive directory (card view on mobile) |
| 2026-01-26 | 0f5183d | Fix mobile header: show login and apply buttons on all screen sizes |
| 2026-01-26 | pending | Add comprehensive developer documentation (DEVELOPER.md) |
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
