// Schedule types for Aurora MySQL scheduler database integration

// Studio/Room information
export interface Studio {
  id: number;
  name: string;
  color: string; // Hex color for calendar display
}

// A scheduled session from the talent_schedule table
export interface ScheduleEntry {
  id: number;
  talentId: number;
  talentName: string;
  talentEmail: string;
  studioId: number;
  studioName: string;
  studioColor: string;
  startingOn: Date;
  endingOn: Date;
  notes?: string;
}

// Widget display format (simplified)
export interface ScheduleWidgetEntry {
  id: number;
  studioName: string;
  studioColor: string;
  date: string; // Formatted date string
  time: string; // Formatted time range string
  startingOn: string; // ISO string for sorting
}

// Calendar display format (grouped by date)
export interface ScheduleCalendarDay {
  date: string; // YYYY-MM-DD format
  dayName: string; // "Monday", "Tuesday", etc.
  dayNumber: number; // 1-31
  isToday: boolean;
  isCurrentMonth: boolean;
  entries: ScheduleEntry[];
}

// Calendar month structure
export interface ScheduleCalendarMonth {
  year: number;
  month: number; // 0-11
  monthName: string;
  days: ScheduleCalendarDay[];
}

// Call out request status
export type CallOutStatus = "pending" | "approved" | "denied";

// Call out request stored in DynamoDB
// Note: userId stores the host.id (DynamoDB UUID), NOT the Clerk userId
export interface CallOut {
  id: string; // UUID
  userId: string; // Host.id (DynamoDB UUID) - NOT Clerk userId
  shiftId: number; // Schedule entry ID from MySQL
  shiftDate: string; // ISO date string for the shift
  shiftTime: string; // Time range string
  studioName: string;
  status: CallOutStatus;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  notes?: string; // Optional notes from user
  reviewedBy?: string; // Admin who reviewed
  reviewedAt?: string; // When it was reviewed
}

// Studio colors for calendar display
export const STUDIO_COLORS: Record<string, string> = {
  "Main Room": "#3B82F6", // blue
  "Speed Bingo": "#10B981", // green
  "Break": "#6B7280", // gray
  default: "#6B7280", // gray
};

// Get color for a studio
export function getStudioColor(studioName: string): string {
  return STUDIO_COLORS[studioName] || STUDIO_COLORS.default;
}

// Format date for display
export function formatScheduleDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// Format time range for display
export function formatScheduleTime(start: Date, end: Date): string {
  const formatTime = (d: Date) =>
    d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  return `${formatTime(start)} - ${formatTime(end)}`;
}

// Convert ScheduleEntry to widget format
export function toWidgetEntry(entry: ScheduleEntry): ScheduleWidgetEntry {
  return {
    id: entry.id,
    studioName: entry.studioName,
    studioColor: entry.studioColor,
    date: formatScheduleDate(entry.startingOn),
    time: formatScheduleTime(entry.startingOn, entry.endingOn),
    startingOn: entry.startingOn.toISOString(),
  };
}

// Check if date is today
export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

// Get days in a month
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// Get first day of month (0 = Sunday, 1 = Monday, etc.)
export function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

// Month names
export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

// Day names
export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAY_NAMES_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
