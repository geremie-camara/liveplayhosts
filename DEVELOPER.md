# LivePlayHosts Developer Documentation

A host management platform for LivePlay Mobile. This document provides everything you need to get started developing on this project.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Architecture Overview](#architecture-overview)
5. [Broadcast Messaging System](#broadcast-messaging-system)
6. [API Reference](#api-reference)
7. [Database Schema](#database-schema)
8. [Development Workflow](#development-workflow)

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- AWS account with DynamoDB and S3 access
- Clerk account for authentication
- Resend account for email
- Slack workspace with bot configured
- AWS SNS for SMS (optional)

### Installation

```bash
# Clone the repository
git clone https://github.com/geremie-camara/liveplayhosts.git
cd liveplayhosts

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Set up DynamoDB tables
node scripts/create-training-tables.mjs
node scripts/create-broadcast-tables.mjs
node scripts/create-locations-table.mjs

# Seed sample data (optional)
node scripts/seed-training-data.mjs

# Start development server
npm run dev
```

### Environment Variables

Create `.env.local` with the following:

```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# AWS S3 & DynamoDB
S3_ACCESS_KEY_ID=AKIA...
S3_SECRET_ACCESS_KEY=...
S3_REGION=us-west-2
S3_BUCKET_NAME=liveplayhosts

# Email (Resend)
RESEND_API_KEY=re_...

# Slack
SLACK_BOT_TOKEN=xoxb-...

# Cron Jobs
CRON_SECRET=your-secret-key
```

**Important:** For Amplify deployments, set `SLACK_BOT_TOKEN` with branch set to "main" only (not "All branches").

---

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Authentication | Clerk (`@clerk/nextjs`) |
| Database | AWS DynamoDB |
| Storage | AWS S3 |
| Email | Resend |
| SMS | AWS SNS |
| Slack | `@slack/web-api` |
| Rich Text Editor | TipTap |
| Forms | react-hook-form |
| Deployment | AWS Amplify |

---

## Project Structure

```
src/
├── app/
│   ├── api/                    # API Routes
│   │   ├── admin/
│   │   │   ├── broadcasts/     # Broadcast management
│   │   │   ├── locations/      # Location management
│   │   │   ├── templates/      # Template management
│   │   │   ├── training/       # Training management
│   │   │   └── videos/         # Video library
│   │   ├── hosts/              # Host CRUD
│   │   ├── messages/           # User message inbox
│   │   ├── availability/       # Scheduling
│   │   ├── locations/          # Public locations
│   │   ├── training/           # User training
│   │   ├── upload-url/         # S3 presigned URLs
│   │   └── cron/               # Scheduled jobs
│   │
│   ├── admin/                  # Admin UI pages
│   │   ├── broadcasts/         # Broadcast management
│   │   ├── locations/          # Location management
│   │   ├── templates/          # Template management
│   │   ├── training/           # Training management
│   │   └── users/              # User management
│   │
│   ├── dashboard/              # User dashboard
│   ├── directory/              # Host directory
│   ├── messages/               # User message center
│   ├── profile/                # User profile
│   ├── training/               # Training courses
│   └── availability/           # Availability settings
│
├── components/
│   ├── training/               # LMS components
│   ├── DirectoryList.tsx
│   ├── MessageCenter.tsx       # Dashboard message widget
│   ├── RichTextEditor.tsx      # TipTap WYSIWYG editor
│   ├── Sidebar.tsx
│   ├── UserSelector.tsx        # 3-column recipient picker
│   └── VideoUpload.tsx         # Video upload with library
│
└── lib/
    ├── broadcast-sender.ts     # Multi-channel send logic
    ├── broadcast-types.ts      # Broadcast type definitions
    ├── dynamodb.ts             # DynamoDB client
    ├── email.ts                # Resend integration
    ├── location-types.ts       # Location types
    ├── roles.ts                # RBAC permissions
    ├── s3.ts                   # S3 client
    ├── slack.ts                # Slack integration
    ├── sms.ts                  # AWS SNS integration
    ├── training-types.ts       # LMS types
    └── types.ts                # Core types
```

---

## Architecture Overview

### Authentication Flow

1. User signs in via Clerk
2. Clerk webhook syncs user to `liveplayhosts-hosts` table
3. User role determines permissions (see `src/lib/roles.ts`)

### User Roles

| Role | Description | Admin Access |
|------|-------------|--------------|
| `applicant` | New applications | No |
| `rejected` | Rejected applicants | No |
| `host` | Approved hosts | No |
| `producer` | Producers | No |
| `talent` | Talent team | Yes |
| `admin` | Administrators | Yes |
| `owner` | Owners | Yes |
| `finance` | Finance team | Limited |
| `hr` | HR team | Limited |

### Permission Checks

```typescript
import { hasPermission, PERMISSIONS } from '@/lib/roles';

// Check if user can manage broadcasts
if (hasPermission(user.role, PERMISSIONS.manageBroadcasts)) {
  // Allow access
}
```

---

## Broadcast Messaging System

The broadcast system enables admins to send targeted messages via Slack, Email, and SMS.

### Core Concepts

#### Broadcast Lifecycle

```
Draft → Scheduled (optional) → Sending → Sent
                                    ↓
                                  Failed
```

#### Data Models

**Broadcast** - Main message entity
```typescript
interface Broadcast {
  id: string;                    // broadcast-{timestamp}-{randomId}
  title: string;                 // Admin reference name
  subject: string;               // Email subject / display title
  bodyHtml: string;              // Rich HTML content
  bodySms?: string;              // 160-char SMS text
  videoUrl?: string;             // S3 video URL
  videoS3Key?: string;           // S3 key for video
  linkUrl?: string;              // CTA button URL
  linkText?: string;             // CTA button text
  channels: BroadcastChannels;   // Which channels to use
  targetUserIds?: string[];      // Specific recipient IDs
  userSelection?: UserSelection; // Full targeting config
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
  scheduledAt?: string;          // ISO timestamp if scheduled
  sentAt?: string;               // When sent
  stats?: BroadcastStats;        // Delivery statistics
  createdBy: string;             // Admin user ID
  createdAt: string;
  updatedAt: string;
}
```

**BroadcastChannels** - Delivery channels
```typescript
interface BroadcastChannels {
  slack: boolean;              // Slack DM
  email: boolean;              // Email via Resend
  sms: boolean;                // SMS via SNS
  hostProducerChannel: boolean; // Send to producer's Slack
}
```

**BroadcastDelivery** - Per-user tracking
```typescript
interface BroadcastDelivery {
  id: string;                  // {broadcastId}#{userId}
  broadcastId: string;
  userId: string;
  slack?: ChannelDelivery;
  email?: ChannelDelivery;
  sms?: ChannelDelivery;
  readAt?: string;             // When user viewed message
  createdAt: string;
}

interface ChannelDelivery {
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  sentAt?: string;
  messageId?: string;
  error?: string;
}
```

### Sending Flow

```
1. Admin creates broadcast (POST /api/admin/broadcasts)
   ↓
2. Broadcast saved as "draft"
   ↓
3. Admin clicks Send (POST /api/admin/broadcasts/[id]/send)
   ↓
4. sendBroadcast() orchestrates delivery:
   a. Validates broadcast status
   b. Resolves target hosts from userSelection
   c. Generates presigned URLs for S3 assets (7-day expiry)
   d. For each recipient:
      - Check rate limit (50/day per user)
      - Create BroadcastDelivery record
      - Send via each enabled channel
      - Update delivery status
   e. Aggregate stats
   f. Update broadcast status to "sent"
```

### Channel Implementations

#### Slack (`src/lib/slack.ts`)

- Uses `@slack/web-api` SDK
- Converts HTML to Slack markdown (mrkdwn)
- Uses Block Kit for rich formatting
- Images extracted and displayed as separate blocks
- Video shown as "Watch Video" button

```typescript
import { sendSlackDM } from '@/lib/slack';

await sendSlackDM(
  slackId,        // User's Slack ID
  subject,        // Message header
  bodyHtml,       // HTML content (converted to mrkdwn)
  videoUrl,       // Optional video URL
  linkUrl,        // Optional CTA URL
  linkText,       // Optional CTA text
  senderName      // "Sent by X" footer
);
```

#### Email (`src/lib/email.ts`)

- Uses Resend API
- HTML template with logo, formatted body, video thumbnail, CTA button
- Sender attribution in footer
- Links to message center

```typescript
import { sendBroadcastEmail } from '@/lib/email';

await sendBroadcastEmail(
  'user@example.com',
  'Subject Line',
  '<p>HTML content</p>',
  videoUrl,
  linkUrl,
  linkText,
  senderName
);
```

#### SMS (`src/lib/sms.ts`)

- Uses AWS SNS
- 160 character limit (auto-truncated)
- Includes link to message center
- Format: "New message: {subject}. {body} Read: {url}"

```typescript
import { sendBroadcastSms } from '@/lib/sms';

await sendBroadcastSms(
  '+15551234567',
  'Subject',
  'Short message body',
  broadcastId
);
```

### Key Components

#### UserSelector

Three-column recipient picker with filtering:

```tsx
import UserSelector from '@/components/UserSelector';

<UserSelector
  value={userSelection}
  onChange={(selection) => setUserSelection(selection)}
/>
```

Features:
- Left panel: Role and location filters
- Middle panel: Available users (filtered)
- Right panel: Selected recipients
- "Add All" / "Remove All" bulk actions
- Search within each panel
- Collapsible interface

#### RichTextEditor

TipTap-based WYSIWYG editor:

```tsx
import RichTextEditor from '@/components/RichTextEditor';

<RichTextEditor
  content={bodyHtml}
  onChange={(html) => setBodyHtml(html)}
  placeholder="Compose your message..."
/>
```

Features:
- Bold, italic, headings, lists
- Link insertion
- Image upload (paste, drag-drop, or file picker)
- Blockquotes, code blocks
- Undo/redo

#### VideoUpload

Video upload with library browser:

```tsx
import VideoUpload from '@/components/VideoUpload';

<VideoUpload
  value={videoUrl}
  onChange={(url) => setVideoUrl(url)}
  folder="broadcast-videos"
/>
```

Features:
- Drag-drop or click to upload
- Progress bar during upload
- Video preview
- Library browser for previously uploaded videos
- 500MB max, MP4/MOV/WebM/AVI supported

### S3 URL Handling

All S3 URLs are presigned with 7-day expiration:

```typescript
import { generatePresignedUrl } from '@/lib/s3';

const presignedUrl = await generatePresignedUrl(s3Key, 604800); // 7 days
```

On send, the system:
1. Extracts S3 URLs from HTML content
2. Strips old query parameters
3. Generates fresh presigned URLs
4. Creates separate versions for Slack (raw) and Email (HTML-encoded)

### Rate Limiting

- 50 broadcasts per day per user
- Enforced at send time
- Query based on delivery records created today

---

## API Reference

### Broadcast APIs

#### List Broadcasts
```
GET /api/admin/broadcasts
Query: ?status=draft|scheduled|sent
Response: Broadcast[]
```

#### Create Broadcast
```
POST /api/admin/broadcasts
Body: { title, subject, bodyHtml, bodySms?, channels, userSelection }
Response: Broadcast
```

#### Get Broadcast
```
GET /api/admin/broadcasts/[id]
Response: Broadcast (with presigned URLs)
```

#### Update Broadcast
```
PUT /api/admin/broadcasts/[id]
Body: { title?, subject?, bodyHtml?, ... }
Response: Broadcast
```

#### Delete Broadcast
```
DELETE /api/admin/broadcasts/[id]
Response: { success: true }
```

#### Send Broadcast
```
POST /api/admin/broadcasts/[id]/send
Body: { scheduledAt?: string }
Response: { success, status, stats?, scheduledAt? }
```

#### Get Deliveries
```
GET /api/admin/broadcasts/[id]/deliveries
Query: ?page=1&limit=50&status=delivered|failed|read|unread
Response: { deliveries: BroadcastDelivery[], pagination }
```

### User Message APIs

#### List Messages
```
GET /api/messages
Response: UserMessage[]
```

#### Mark as Read
```
POST /api/messages/[id]/read
Response: { success: true }
```

#### Unread Count
```
GET /api/messages/unread-count
Response: { count: number }
```

### Template APIs

#### List Templates
```
GET /api/admin/templates
Response: BroadcastTemplate[]
```

#### Create Template
```
POST /api/admin/templates
Body: { name, subject, bodyHtml, channels, userSelection? }
Response: BroadcastTemplate
```

#### Get/Update/Delete Template
```
GET/PUT/DELETE /api/admin/templates/[id]
```

### Upload APIs

#### Get Upload URL
```
GET /api/upload-url?filename=video.mp4&contentType=video/mp4&folder=broadcast-videos
Response: { uploadUrl, fileUrl }
```

#### List Videos
```
GET /api/admin/videos?folder=broadcast-videos
Response: { videos: VideoItem[] }
```

---

## Database Schema

### DynamoDB Tables

| Table | Key | GSIs |
|-------|-----|------|
| `liveplayhosts-hosts` | `id` | `email-index`, `clerkUserId-index` |
| `liveplayhosts-broadcasts` | `id` | `status-createdAt-index`, `status-scheduledAt-index` |
| `liveplayhosts-broadcast-deliveries` | `id` | `broadcastId-index`, `userId-createdAt-index` |
| `liveplayhosts-broadcast-templates` | `id` | - |
| `liveplayhosts-locations` | `id` | - |
| `liveplayhosts-availability` | `userId` | - |
| `liveplayhosts-courses` | `id` | `status-index`, `category-index` |
| `liveplayhosts-sections` | `id` | `courseId-index` |
| `liveplayhosts-lessons` | `id` | `sectionId-index` |
| `liveplayhosts-training-progress` | `userId#courseId` | `userId-index` |

### S3 Bucket Structure

```
liveplayhosts/
├── headshots/           # User profile photos
├── training-videos/     # LMS course videos
├── broadcast-videos/    # Broadcast attachments
└── broadcast-images/    # Inline images from editor
```

---

## Development Workflow

### Running Locally

```bash
npm run dev          # Start dev server on http://localhost:3000
npm run build        # Production build
npm run lint         # Run ESLint
```

### Creating DynamoDB Tables

```bash
# Training tables (courses, sections, lessons, etc.)
node scripts/create-training-tables.mjs

# Broadcast tables (broadcasts, deliveries, templates)
node scripts/create-broadcast-tables.mjs

# Locations table
node scripts/create-locations-table.mjs
```

### Debug Scripts

```bash
node scripts/debug-messages.mjs      # Debug message delivery
node scripts/debug-email.mjs         # Test email sending
node scripts/test-slack.mjs          # Test Slack integration
node scripts/check-deliveries.mjs    # Check delivery status
node scripts/check-user-slack.mjs    # Verify user Slack IDs
```

### Adding a New Feature

1. Define types in `src/lib/[feature]-types.ts`
2. Create API routes in `src/app/api/[feature]/`
3. Add UI pages in `src/app/[feature]/`
4. Create components in `src/components/`
5. Update `CLAUDE.md` with documentation

### Code Style

- Use TypeScript strict mode
- Prefer async/await over callbacks
- Use Tailwind for styling (no CSS modules)
- Follow existing patterns for API routes
- Add proper error handling and logging

### Testing Broadcasts Locally

1. Create a test broadcast via admin UI
2. Add yourself as a recipient
3. Use "Send" to test immediate delivery
4. Check console logs for delivery status
5. Verify message appears in `/messages`

### Deployment

The project deploys automatically via AWS Amplify on push to `main`:

```bash
git add .
git commit -m "Your changes"
git push origin main
```

Build settings are in `amplify.yml`.

---

## Troubleshooting

### Slack Messages Not Sending

1. Verify `SLACK_BOT_TOKEN` is set correctly
2. Check bot has `chat:write` and `users:read` scopes
3. Verify user has `slackId` in hosts table
4. Check Amplify environment variable is set for "main" branch only

### Emails Not Sending

1. Verify `RESEND_API_KEY` is set
2. Check sender domain is verified in Resend
3. Review Resend dashboard for delivery logs

### S3 Uploads Failing

1. Check AWS credentials are valid
2. Verify CORS is configured on S3 bucket
3. Check bucket policy allows presigned URL uploads

### Images Not Displaying

1. Presigned URLs expire after 7 days
2. Check S3 bucket permissions
3. Verify image was uploaded successfully

---

## Contact

For questions or issues, contact the development team or open an issue in the repository.
