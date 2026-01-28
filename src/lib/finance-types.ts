// Finance types for host pay review system

export const HOURLY_RATE = 65;

export type FinanceReviewStatus = "pending" | "accepted" | "disputed";

export interface FinanceReview {
  hostId: string; // host.id (DynamoDB UUID)
  date: string; // YYYY-MM-DD
  payCycleKey: string; // "2026-01-H1" or "2026-01-H2"
  status: FinanceReviewStatus;
  disputeText?: string;
  hoursWorked: number;
  totalPay: number;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Pay cycle half: 1 = 1st-15th, 2 = 16th-end of month
export type PayCycleHalf = 1 | 2;

/**
 * Get the pay cycle key for a given year, month, and half.
 * Example: getPayCycleKey(2026, 0, 1) => "2026-01-H1"
 */
export function getPayCycleKey(year: number, month: number, half: PayCycleHalf): string {
  const monthStr = String(month + 1).padStart(2, "0");
  return `${year}-${monthStr}-H${half}`;
}

/**
 * Get the date range for a pay cycle.
 * Half 1: 1st through 15th
 * Half 2: 16th through last day of month
 */
export function getPayCycleDateRange(
  year: number,
  month: number,
  half: PayCycleHalf
): { startDate: string; endDate: string } {
  const monthStr = String(month + 1).padStart(2, "0");
  if (half === 1) {
    return {
      startDate: `${year}-${monthStr}-01`,
      endDate: `${year}-${monthStr}-15`,
    };
  }
  const lastDay = new Date(year, month + 1, 0).getDate();
  return {
    startDate: `${year}-${monthStr}-16`,
    endDate: `${year}-${monthStr}-${String(lastDay).padStart(2, "0")}`,
  };
}

/**
 * Get a human-readable label for a pay cycle.
 * Example: getPayCycleLabel(2026, 0, 1) => "Jan 1-15, 2026"
 */
export function getPayCycleLabel(year: number, month: number, half: PayCycleHalf): string {
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  if (half === 1) {
    return `${monthNames[month]} 1-15, ${year}`;
  }
  const lastDay = new Date(year, month + 1, 0).getDate();
  return `${monthNames[month]} 16-${lastDay}, ${year}`;
}

/**
 * Get the most recent completed pay period.
 * If today is Jan 20, the most recent completed period is Jan 1-15.
 * If today is Jan 10, the most recent completed period is Dec 16-31 of previous year.
 */
export function getCurrentPayCycle(): { year: number; month: number; half: PayCycleHalf } {
  const today = new Date();
  const day = today.getDate();
  const month = today.getMonth();
  const year = today.getFullYear();

  if (day > 15) {
    // We're in the second half, so the most recent completed is the first half of this month
    return { year, month, half: 1 };
  } else {
    // We're in the first half, so the most recent completed is the second half of last month
    if (month === 0) {
      return { year: year - 1, month: 11, half: 2 };
    }
    return { year, month: month - 1, half: 2 };
  }
}
