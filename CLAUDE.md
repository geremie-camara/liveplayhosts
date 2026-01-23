# LivePlayHosts

A host management platform for LivePlay Mobile. Hosts can apply, manage their profiles, set availability, and complete training courses.

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

## Scripts

```bash
npm run dev                              # Start dev server
npm run build                            # Production build
npm run lint                             # Run ESLint
node scripts/create-training-tables.mjs # Create DynamoDB tables
node scripts/seed-training-data.mjs     # Seed sample courses
```

## Environment Variables

See `.env.example` for required variables:
- Clerk keys (NEXT_PUBLIC_CLERK_*, CLERK_SECRET_KEY)
- AWS credentials (S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_REGION)
- S3 bucket config

## Deployment Log

| Date | Commit | Description |
|------|--------|-------------|
| 2026-01-23 | cdb2b1b | Update header: larger logo, add Host Login button |
| 2026-01-23 | d412387 | Rebrand to LivePlay (one word) across the site |
