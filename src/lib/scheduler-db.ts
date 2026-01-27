// MySQL connection to Aurora scheduler database

import mysql from "mysql2/promise";
import { ScheduleEntry, getStudioColor } from "./schedule-types";

// Connection pool for the scheduler database
let pool: mysql.Pool | null = null;

function getPool(): mysql.Pool {
  if (!pool) {
    const host = process.env.SCHEDULER_DB_HOST;
    const database = process.env.SCHEDULER_DB_NAME;
    const user = process.env.SCHEDULER_DB_USER;
    const password = process.env.SCHEDULER_DB_PASSWORD;

    if (!host || !database || !user || !password) {
      throw new Error("Scheduler database credentials not configured");
    }

    pool = mysql.createPool({
      host,
      database,
      user,
      password,
      waitForConnections: true,
      connectionLimit: 10,
      maxIdle: 5,
      idleTimeout: 60000,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });
  }

  return pool;
}

// Raw schedule row from MySQL
interface ScheduleRow {
  id: number;
  talent_id: number;
  talent_name: string;
  talent_email: string;
  studio_id: number;
  studio_name: string;
  starting_on: Date;
  ending_on: Date;
  notes: string | null;
}

// Get talent ID by email
export async function getTalentIdByEmail(email: string): Promise<number | null> {
  try {
    const db = getPool();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT id FROM talent WHERE email = ? LIMIT 1",
      [email.toLowerCase()]
    );

    if (rows.length === 0) {
      return null;
    }

    return rows[0].id as number;
  } catch (error) {
    console.error("Error fetching talent by email:", error);
    throw error;
  }
}

// Get schedule entries for a talent
export async function getScheduleForTalent(
  talentId: number,
  options?: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }
): Promise<ScheduleEntry[]> {
  try {
    const db = getPool();

    let query = `
      SELECT
        ts.id,
        ts.talent_id,
        t.first_name AS talent_first_name,
        t.last_name AS talent_last_name,
        t.email AS talent_email,
        ts.studio_id,
        s.name AS studio_name,
        ts.starting_on,
        ts.ending_on,
        ts.notes
      FROM talent_schedule ts
      JOIN talent t ON ts.talent_id = t.id
      JOIN studio s ON ts.studio_id = s.id
      WHERE ts.talent_id = ?
    `;

    const params: (number | Date | string)[] = [talentId];

    if (options?.startDate) {
      query += " AND ts.starting_on >= ?";
      params.push(options.startDate);
    }

    if (options?.endDate) {
      query += " AND ts.starting_on <= ?";
      params.push(options.endDate);
    }

    query += " ORDER BY ts.starting_on ASC";

    if (options?.limit) {
      query += " LIMIT ?";
      params.push(options.limit);
    }

    const [rows] = await db.execute<mysql.RowDataPacket[]>(query, params);

    return (rows as unknown as Array<{
      id: number;
      talent_id: number;
      talent_first_name: string;
      talent_last_name: string;
      talent_email: string;
      studio_id: number;
      studio_name: string;
      starting_on: Date;
      ending_on: Date;
      notes: string | null;
    }>).map((row) => ({
      id: row.id,
      talentId: row.talent_id,
      talentName: `${row.talent_first_name} ${row.talent_last_name}`.trim(),
      talentEmail: row.talent_email,
      studioId: row.studio_id,
      studioName: row.studio_name,
      studioColor: getStudioColor(row.studio_name),
      startingOn: new Date(row.starting_on),
      endingOn: new Date(row.ending_on),
      notes: row.notes || undefined,
    }));
  } catch (error) {
    console.error("Error fetching schedule for talent:", error);
    throw error;
  }
}

// Get upcoming schedule entries for a talent
export async function getUpcomingSchedule(
  talentId: number,
  limit: number = 5
): Promise<ScheduleEntry[]> {
  return getScheduleForTalent(talentId, {
    startDate: new Date(),
    limit,
  });
}

// Get schedule entries for a talent for a specific month
export async function getScheduleForMonth(
  talentId: number,
  year: number,
  month: number
): Promise<ScheduleEntry[]> {
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59);

  return getScheduleForTalent(talentId, { startDate, endDate });
}

// Get all schedule entries for a date range (for admin/calendar sync)
export async function getAllSchedulesForRange(
  startDate: Date,
  endDate: Date
): Promise<ScheduleEntry[]> {
  try {
    const db = getPool();

    const query = `
      SELECT
        ts.id,
        ts.talent_id,
        t.first_name AS talent_first_name,
        t.last_name AS talent_last_name,
        t.email AS talent_email,
        ts.studio_id,
        s.name AS studio_name,
        ts.starting_on,
        ts.ending_on,
        ts.notes
      FROM talent_schedule ts
      JOIN talent t ON ts.talent_id = t.id
      JOIN studio s ON ts.studio_id = s.id
      WHERE ts.starting_on >= ? AND ts.starting_on <= ?
      ORDER BY ts.starting_on ASC
    `;

    const [rows] = await db.execute<mysql.RowDataPacket[]>(query, [startDate, endDate]);

    return (rows as unknown as Array<{
      id: number;
      talent_id: number;
      talent_first_name: string;
      talent_last_name: string;
      talent_email: string;
      studio_id: number;
      studio_name: string;
      starting_on: Date;
      ending_on: Date;
      notes: string | null;
    }>).map((row) => ({
      id: row.id,
      talentId: row.talent_id,
      talentName: `${row.talent_first_name} ${row.talent_last_name}`.trim(),
      talentEmail: row.talent_email,
      studioId: row.studio_id,
      studioName: row.studio_name,
      studioColor: getStudioColor(row.studio_name),
      startingOn: new Date(row.starting_on),
      endingOn: new Date(row.ending_on),
      notes: row.notes || undefined,
    }));
  } catch (error) {
    console.error("Error fetching all schedules:", error);
    throw error;
  }
}

// Get all studios
export async function getStudios(): Promise<Array<{ id: number; name: string }>> {
  try {
    const db = getPool();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT id, name FROM studio ORDER BY name"
    );

    return rows as Array<{ id: number; name: string }>;
  } catch (error) {
    console.error("Error fetching studios:", error);
    throw error;
  }
}

// Check if scheduler database is configured
export function isSchedulerDbConfigured(): boolean {
  return !!(
    process.env.SCHEDULER_DB_HOST &&
    process.env.SCHEDULER_DB_NAME &&
    process.env.SCHEDULER_DB_USER &&
    process.env.SCHEDULER_DB_PASSWORD
  );
}

// Close the pool (for graceful shutdown)
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
