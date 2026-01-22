# LivePlayHosts

A host management platform for LivePlay Mobile. Hosts can apply, manage their profiles, set availability, and complete training courses.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Auth**: Clerk (`@clerk/nextjs`)
- **Database**: AWS DynamoDB
- **Storage**: AWS S3 (headshots, video uploads)
- **Email**: Resend
- **Forms**: react-hook-form
- **Deployment**: AWS Amplify

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   │   ├── training/      # LMS API (courses, lessons)
│   │   ├── hosts/         # Host CRUD
│   │   ├── profile/       # User profile
│   │   └── availability/  # Scheduling
│   ├── admin/             # Admin dashboard
│   ├── training/          # LMS pages (in progress)
│   ├── dashboard/         # User dashboard
│   ├── directory/         # Host directory
│   ├── profile/           # Profile management
│   └── availability/      # Availability scheduling
├── components/
│   ├── training/          # LMS components
│   └── *.tsx              # Shared components
└── lib/
    ├── types.ts           # Core types (Host, UserRole, etc.)
    ├── training-types.ts  # LMS types (Course, Lesson, Quiz, etc.)
    ├── roles.ts           # Role-based access control
    ├── dynamodb.ts        # DynamoDB client
    └── s3.ts              # S3 client
```

## User Roles

Defined in `src/lib/types.ts`:
- `applicant` - New applicants
- `rejected` - Rejected applicants
- `host` - Approved hosts
- `producer` - Producers
- `talent` - Talent
- `admin` - Administrators
- `owner` - Owners
- `finance` - Finance team
- `hr` - HR team

## Current Work: LMS Feature

Adding a Learning Management System for host training.

### Completed
- Data models in `src/lib/training-types.ts`:
  - Course, Section, Lesson, Quiz, FAQ
  - TrainingProgress, QuizAttempt
  - CourseCategory: onboarding, skills, advanced, compliance
  - LessonType: video, article, quiz, faq
- Components in `src/components/training/`:
  - CourseCard, CourseProgress, LessonList
  - VideoPlayer, ArticleContent
- API routes:
  - `/api/training/courses` - List/create courses
  - `/api/training/courses/[id]` - Get/update course
  - `/api/training/lessons/[id]` - Get/update lesson

### TODO
- [x] Create training page files:
  - [x] `/training/page.tsx` - Course listing
  - [x] `/training/courses/[courseId]/page.tsx` - Course detail
  - [x] `/training/lessons/[lessonId]/page.tsx` - Lesson viewer
  - [x] `LessonContent.tsx` - Client component for lesson display
  - [ ] `/training/faqs/page.tsx` - FAQ page
  - [ ] `/training/progress/page.tsx` - User progress dashboard
- [x] Progress tracking API routes (`/api/training/progress`)
- [ ] Quiz component and functionality
- [ ] Admin training management pages
- [ ] DynamoDB tables for training data (need to create in AWS)

## Commands

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run lint     # Run ESLint
```

## Environment Variables

See `.env.example` for required variables:
- Clerk keys
- AWS credentials
- DynamoDB table names
- S3 bucket config
