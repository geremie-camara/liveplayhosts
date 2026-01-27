// User role in the system
export type UserRole = "applicant" | "rejected" | "host" | "producer" | "talent" | "admin" | "owner" | "finance" | "hr";

// Scheduling priority for hosts
export type SchedulingPriority = "high" | "medium" | "low";

// Database record for a user
export interface Host {
  id: string;

  // Role (replaces old status + role system)
  role: UserRole;

  // Personal Information
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  birthday?: string; // Format: YYYY-MM-DD
  location?: string; // Simplified location (city/region)

  // Address
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };

  // Slack Integration
  slackId?: string;
  slackChannelId?: string; // Host producer channel Slack ID

  // Social Profiles
  socialProfiles: {
    instagram?: string;
    tiktok?: string;
    youtube?: string;
    linkedin?: string;
    other?: string;
  };

  // Application Info
  experience: string;
  videoReelUrl?: string;
  headshotUrl?: string;
  headshotExternalUrl?: string; // Fallback URL if no uploaded headshot

  // Clerk Integration
  clerkUserId?: string;

  // Timestamps
  appliedAt: string;
  invitedAt?: string;
  hiredAt?: string;
  createdAt: string;
  updatedAt: string;

  // Notes (admin can add notes about the host)
  notes?: string;

  // Scheduling priority (high/medium/low)
  schedulingPriority?: SchedulingPriority;
}

// Role display configuration
export const ROLE_CONFIG: Record<UserRole, { label: string; color: string }> = {
  applicant: { label: "Applicant", color: "bg-yellow-100 text-yellow-800" },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-800" },
  host: { label: "Host", color: "bg-green-100 text-green-800" },
  producer: { label: "Producer", color: "bg-purple-100 text-purple-800" },
  talent: { label: "Talent", color: "bg-pink-100 text-pink-800" },
  admin: { label: "Admin", color: "bg-blue-100 text-blue-800" },
  owner: { label: "Owner", color: "bg-indigo-100 text-indigo-800" },
  finance: { label: "Finance", color: "bg-emerald-100 text-emerald-800" },
  hr: { label: "HR", color: "bg-orange-100 text-orange-800" },
};

// Daily availability for a single day
export interface DayAvailability {
  enabled: boolean;
  startTime: string; // Format: "HH:MM" (24-hour)
  endTime: string;   // Format: "HH:MM" (24-hour)
}

// Weekly availability schedule
export interface WeeklyAvailability {
  monday: DayAvailability;
  tuesday: DayAvailability;
  wednesday: DayAvailability;
  thursday: DayAvailability;
  friday: DayAvailability;
  saturday: DayAvailability;
  sunday: DayAvailability;
}

// Blocked date range (for vacations, etc.)
export interface BlockedDateRange {
  id: string;
  startDate: string; // Format: "YYYY-MM-DD"
  endDate: string;   // Format: "YYYY-MM-DD"
  reason?: string;
}

// User availability record
export interface UserAvailability {
  userId: string; // Reference to Host.id
  weekly: WeeklyAvailability;
  blockedDates: BlockedDateRange[];
  updatedAt: string;
}

// Availability change log entry (tracks host-initiated changes)
export interface AvailabilityChangeLog {
  id: string; // UUID
  odIndex: string; // Global secondary index: odIndex for ordering
  userId: string; // Host's Clerk userId
  hostId?: string; // Host's DynamoDB id (if available)
  hostName: string; // Host's name at time of change
  hostEmail: string; // Host's email at time of change
  changeType: "weekly" | "blocked_dates" | "both";
  changes: {
    weekly?: {
      before: WeeklyAvailability;
      after: WeeklyAvailability;
      summary: string; // Human-readable summary of changes
    };
    blockedDates?: {
      added: BlockedDateRange[];
      removed: BlockedDateRange[];
      summary: string;
    };
  };
  createdAt: string; // ISO timestamp
}

// Form data for creating/updating a user
export interface HostFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  birthday?: string;
  location?: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  instagram?: string;
  tiktok?: string;
  youtube?: string;
  linkedin?: string;
  otherSocial?: string;
  experience: string;
  videoReelUrl?: string;
  headshotUrl?: string;
  role?: UserRole;
  notes?: string;
  slackId?: string;
  slackChannelId?: string;
}
