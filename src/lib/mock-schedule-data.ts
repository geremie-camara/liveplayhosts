// Mock schedule data for development (while waiting for DB access)

import { ScheduleEntry, Studio, getStudioColor } from "./schedule-types";

// Mock studios
export const MOCK_STUDIOS: Studio[] = [
  { id: 1, name: "Studio A", color: "#3B82F6" },
  { id: 2, name: "Studio B", color: "#10B981" },
  { id: 3, name: "Studio C", color: "#F59E0B" },
  { id: 4, name: "Virtual", color: "#6366F1" },
];

// Helper to create dates relative to today
function daysFromNow(days: number, hour: number = 10, minute: number = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date;
}

// Generate mock schedule entries for a user
export function getMockScheduleEntries(userEmail: string): ScheduleEntry[] {
  // Return different mock data based on user email for testing
  // In production, this will be replaced with real DB queries

  const mockEntries: ScheduleEntry[] = [
    {
      id: 1,
      talentId: 1,
      talentName: "Test Host",
      talentEmail: userEmail,
      studioId: 1,
      studioName: "Studio A",
      studioColor: getStudioColor("Studio A"),
      startingOn: daysFromNow(0, 14, 0), // Today at 2pm
      endingOn: daysFromNow(0, 18, 0),   // Today at 6pm
      notes: "Live shopping event",
    },
    {
      id: 2,
      talentId: 1,
      talentName: "Test Host",
      talentEmail: userEmail,
      studioId: 2,
      studioName: "Studio B",
      studioColor: getStudioColor("Studio B"),
      startingOn: daysFromNow(1, 10, 0), // Tomorrow at 10am
      endingOn: daysFromNow(1, 14, 0),   // Tomorrow at 2pm
    },
    {
      id: 3,
      talentId: 1,
      talentName: "Test Host",
      talentEmail: userEmail,
      studioId: 4,
      studioName: "Virtual",
      studioColor: getStudioColor("Virtual"),
      startingOn: daysFromNow(2, 9, 0),  // Day after tomorrow at 9am
      endingOn: daysFromNow(2, 12, 0),
      notes: "Remote session",
    },
    {
      id: 4,
      talentId: 1,
      talentName: "Test Host",
      talentEmail: userEmail,
      studioId: 1,
      studioName: "Studio A",
      studioColor: getStudioColor("Studio A"),
      startingOn: daysFromNow(5, 13, 0),
      endingOn: daysFromNow(5, 17, 0),
    },
    {
      id: 5,
      talentId: 1,
      talentName: "Test Host",
      talentEmail: userEmail,
      studioId: 3,
      studioName: "Studio C",
      studioColor: getStudioColor("Studio C"),
      startingOn: daysFromNow(7, 11, 0),
      endingOn: daysFromNow(7, 15, 0),
    },
    {
      id: 6,
      talentId: 1,
      talentName: "Test Host",
      talentEmail: userEmail,
      studioId: 2,
      studioName: "Studio B",
      studioColor: getStudioColor("Studio B"),
      startingOn: daysFromNow(10, 14, 0),
      endingOn: daysFromNow(10, 18, 0),
    },
    {
      id: 7,
      talentId: 1,
      talentName: "Test Host",
      talentEmail: userEmail,
      studioId: 4,
      studioName: "Virtual",
      studioColor: getStudioColor("Virtual"),
      startingOn: daysFromNow(14, 10, 0),
      endingOn: daysFromNow(14, 14, 0),
    },
  ];

  // Sort by start time
  return mockEntries.sort((a, b) => a.startingOn.getTime() - b.startingOn.getTime());
}

// Get upcoming schedule entries (next N entries from today)
export function getUpcomingMockEntries(userEmail: string, limit: number = 5): ScheduleEntry[] {
  const now = new Date();
  const entries = getMockScheduleEntries(userEmail);

  return entries
    .filter(e => e.startingOn >= now)
    .slice(0, limit);
}

// Get schedule entries for a specific month
export function getMockEntriesForMonth(
  userEmail: string,
  year: number,
  month: number
): ScheduleEntry[] {
  const entries = getMockScheduleEntries(userEmail);

  return entries.filter(e => {
    return e.startingOn.getFullYear() === year && e.startingOn.getMonth() === month;
  });
}

// Flag to indicate we're using mock data
export const USING_MOCK_DATA = true;
