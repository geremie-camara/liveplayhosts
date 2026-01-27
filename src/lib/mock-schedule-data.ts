// Mock schedule data for development (while waiting for DB access)

import { ScheduleEntry, Studio, getStudioColor } from "./schedule-types";

// Mock studios (rooms)
export const MOCK_STUDIOS: Studio[] = [
  { id: 1, name: "Main Room", color: "#3B82F6" },
  { id: 2, name: "Studio B", color: "#10B981" },
  { id: 3, name: "Green Room", color: "#F59E0B" },
  { id: 4, name: "Virtual", color: "#6366F1" },
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
// Pattern: Hosts move between rooms hourly, with breaks
export function getMockScheduleEntries(userEmail: string): ScheduleEntry[] {
  const entries: ScheduleEntry[] = [];
  let id = 1;

  // Today: 10am-2pm with break at noon
  // 10am Main Room, 11am Studio B, [12pm break], 1pm Green Room, 2pm Main Room
  entries.push(createHourlyEntry(id++, userEmail, 0, 10, "Main Room"));
  entries.push(createHourlyEntry(id++, userEmail, 0, 11, "Studio B"));
  // 12pm break
  entries.push(createHourlyEntry(id++, userEmail, 0, 13, "Green Room"));
  entries.push(createHourlyEntry(id++, userEmail, 0, 14, "Main Room"));

  // Tomorrow: 2pm-6pm with break at 4pm
  // 2pm Main Room, 3pm Main Room, [4pm break], 5pm Studio B, 6pm Virtual
  entries.push(createHourlyEntry(id++, userEmail, 1, 14, "Main Room"));
  entries.push(createHourlyEntry(id++, userEmail, 1, 15, "Main Room"));
  // 4pm break
  entries.push(createHourlyEntry(id++, userEmail, 1, 17, "Studio B"));
  entries.push(createHourlyEntry(id++, userEmail, 1, 18, "Virtual"));

  // Day 2: 9am-1pm with break at 11am
  // 9am Green Room, 10am Main Room, [11am break], 12pm Main Room, 1pm Studio B
  entries.push(createHourlyEntry(id++, userEmail, 2, 9, "Green Room"));
  entries.push(createHourlyEntry(id++, userEmail, 2, 10, "Main Room"));
  // 11am break
  entries.push(createHourlyEntry(id++, userEmail, 2, 12, "Main Room"));
  entries.push(createHourlyEntry(id++, userEmail, 2, 13, "Studio B"));

  // Day 5: 11am-3pm with break at 1pm
  entries.push(createHourlyEntry(id++, userEmail, 5, 11, "Main Room"));
  entries.push(createHourlyEntry(id++, userEmail, 5, 12, "Virtual"));
  // 1pm break
  entries.push(createHourlyEntry(id++, userEmail, 5, 14, "Main Room"));
  entries.push(createHourlyEntry(id++, userEmail, 5, 15, "Green Room"));

  // Day 7: 1pm-5pm with break at 3pm
  entries.push(createHourlyEntry(id++, userEmail, 7, 13, "Studio B"));
  entries.push(createHourlyEntry(id++, userEmail, 7, 14, "Main Room"));
  // 3pm break
  entries.push(createHourlyEntry(id++, userEmail, 7, 16, "Main Room"));
  entries.push(createHourlyEntry(id++, userEmail, 7, 17, "Green Room"));

  // Day 10: 10am-2pm with break at noon
  entries.push(createHourlyEntry(id++, userEmail, 10, 10, "Virtual"));
  entries.push(createHourlyEntry(id++, userEmail, 10, 11, "Main Room"));
  // noon break
  entries.push(createHourlyEntry(id++, userEmail, 10, 13, "Studio B"));
  entries.push(createHourlyEntry(id++, userEmail, 10, 14, "Main Room"));

  // Day 14: 3pm-7pm with break at 5pm
  entries.push(createHourlyEntry(id++, userEmail, 14, 15, "Main Room"));
  entries.push(createHourlyEntry(id++, userEmail, 14, 16, "Main Room"));
  // 5pm break
  entries.push(createHourlyEntry(id++, userEmail, 14, 18, "Green Room"));
  entries.push(createHourlyEntry(id++, userEmail, 14, 19, "Virtual"));

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
