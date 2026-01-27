// Mock schedule data for development (while waiting for DB access)

import { ScheduleEntry, Studio, getStudioColor } from "./schedule-types";

// Mock studios (rooms)
export const MOCK_STUDIOS: Studio[] = [
  { id: 1, name: "Main Room", color: "#3B82F6" },
  { id: 2, name: "Speed Bingo", color: "#10B981" },
  { id: 3, name: "Break", color: "#6B7280" },
];

// Helper to create a date at a specific hour
function dateAtHour(daysFromNow: number, hour: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(hour, 0, 0, 0);
  return date;
}

// Create a single hourly entry
function createHourlyEntry(
  id: number,
  userEmail: string,
  daysFromNow: number,
  hour: number,
  studioName: string
): ScheduleEntry {
  const studio = MOCK_STUDIOS.find(s => s.name === studioName) || MOCK_STUDIOS[0];
  return {
    id,
    talentId: 1,
    talentName: "Test Host",
    talentEmail: userEmail,
    studioId: studio.id,
    studioName: studio.name,
    studioColor: getStudioColor(studio.name),
    startingOn: dateAtHour(daysFromNow, hour),
    endingOn: dateAtHour(daysFromNow, hour + 1),
  };
}

// Generate mock schedule entries for a user
// Pattern: Hosts rotate between Main Room, Speed Bingo, and Break
export function getMockScheduleEntries(userEmail: string): ScheduleEntry[] {
  const entries: ScheduleEntry[] = [];
  let id = 1;

  // Today: 10am-3pm
  entries.push(createHourlyEntry(id++, userEmail, 0, 10, "Main Room"));
  entries.push(createHourlyEntry(id++, userEmail, 0, 11, "Main Room"));
  entries.push(createHourlyEntry(id++, userEmail, 0, 12, "Break"));
  entries.push(createHourlyEntry(id++, userEmail, 0, 13, "Speed Bingo"));
  entries.push(createHourlyEntry(id++, userEmail, 0, 14, "Main Room"));

  // Tomorrow: 2pm-7pm
  entries.push(createHourlyEntry(id++, userEmail, 1, 14, "Main Room"));
  entries.push(createHourlyEntry(id++, userEmail, 1, 15, "Speed Bingo"));
  entries.push(createHourlyEntry(id++, userEmail, 1, 16, "Break"));
  entries.push(createHourlyEntry(id++, userEmail, 1, 17, "Main Room"));
  entries.push(createHourlyEntry(id++, userEmail, 1, 18, "Main Room"));

  // Day 2: 9am-2pm
  entries.push(createHourlyEntry(id++, userEmail, 2, 9, "Speed Bingo"));
  entries.push(createHourlyEntry(id++, userEmail, 2, 10, "Main Room"));
  entries.push(createHourlyEntry(id++, userEmail, 2, 11, "Break"));
  entries.push(createHourlyEntry(id++, userEmail, 2, 12, "Main Room"));
  entries.push(createHourlyEntry(id++, userEmail, 2, 13, "Speed Bingo"));

  // Day 5: 11am-4pm
  entries.push(createHourlyEntry(id++, userEmail, 5, 11, "Main Room"));
  entries.push(createHourlyEntry(id++, userEmail, 5, 12, "Main Room"));
  entries.push(createHourlyEntry(id++, userEmail, 5, 13, "Break"));
  entries.push(createHourlyEntry(id++, userEmail, 5, 14, "Speed Bingo"));
  entries.push(createHourlyEntry(id++, userEmail, 5, 15, "Main Room"));

  // Day 7: 1pm-6pm
  entries.push(createHourlyEntry(id++, userEmail, 7, 13, "Speed Bingo"));
  entries.push(createHourlyEntry(id++, userEmail, 7, 14, "Main Room"));
  entries.push(createHourlyEntry(id++, userEmail, 7, 15, "Break"));
  entries.push(createHourlyEntry(id++, userEmail, 7, 16, "Main Room"));
  entries.push(createHourlyEntry(id++, userEmail, 7, 17, "Speed Bingo"));

  // Day 10: 10am-3pm
  entries.push(createHourlyEntry(id++, userEmail, 10, 10, "Main Room"));
  entries.push(createHourlyEntry(id++, userEmail, 10, 11, "Speed Bingo"));
  entries.push(createHourlyEntry(id++, userEmail, 10, 12, "Break"));
  entries.push(createHourlyEntry(id++, userEmail, 10, 13, "Main Room"));
  entries.push(createHourlyEntry(id++, userEmail, 10, 14, "Main Room"));

  // Day 14: 3pm-8pm
  entries.push(createHourlyEntry(id++, userEmail, 14, 15, "Main Room"));
  entries.push(createHourlyEntry(id++, userEmail, 14, 16, "Speed Bingo"));
  entries.push(createHourlyEntry(id++, userEmail, 14, 17, "Break"));
  entries.push(createHourlyEntry(id++, userEmail, 14, 18, "Main Room"));
  entries.push(createHourlyEntry(id++, userEmail, 14, 19, "Speed Bingo"));

  // Sort by start time
  return entries.sort((a, b) => a.startingOn.getTime() - b.startingOn.getTime());
}

// Get upcoming schedule entries (next N entries from now)
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
