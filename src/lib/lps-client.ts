// Low-level HTTP client for LPS Dungeon Data Service REST API
// No business logic — just HTTP transport, auth, and error handling.

const LPS_API_URL = () => process.env.LPS_API_URL || "";
const LPS_API_KEY = () => process.env.LPS_API_KEY || "";

// Check if LPS API is configured
export function isLpsConfigured(): boolean {
  return !!(process.env.LPS_API_URL && process.env.LPS_API_KEY);
}

// --- Types ---

export interface LpsWhereClause {
  field: string;
  condition: "=" | "!=" | ">" | "<" | ">=" | "<=" | "LIKE" | "BETWEEN";
  value: string | number;
  /** Set true for numeric fields so the API treats the value as a number */
  isNumber?: boolean;
  /** Set true for epoch timestamp fields */
  isEpoch?: boolean;
}

export interface LpsReadOptions {
  where?: LpsWhereClause[];
  sort?: { field: string; direction: "ASC" | "DESC" };
  include_deleted?: boolean;
}

interface LpsRequestBody {
  action: string;
  params: Record<string, unknown>;
}

// --- Core POST ---

export async function lpsPost<T = unknown>(body: LpsRequestBody): Promise<T> {
  const url = LPS_API_URL();
  const key = LPS_API_KEY();

  if (!url || !key) {
    throw new Error("LPS API not configured (missing LPS_API_URL or LPS_API_KEY)");
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LPS API error ${res.status}: ${text}`);
  }

  const data = await res.json();

  // The API may wrap results in a body field (API Gateway proxy pattern)
  if (data.body && typeof data.body === "string") {
    try {
      return JSON.parse(data.body) as T;
    } catch {
      return data as T;
    }
  }

  return data as T;
}

// --- Convenience Methods ---

/** List all tables in the LPS database */
export async function lpsShowTables(): Promise<string[]> {
  return lpsPost<string[]>({
    action: "show_tables",
    params: {},
  });
}

/** Describe a table's schema */
export async function lpsDescribe(table: string): Promise<unknown> {
  return lpsPost({
    action: "describe",
    params: { table },
  });
}

/** Read rows from a table with optional WHERE, sort, include_deleted */
export async function lpsRead<T = Record<string, unknown>>(
  table: string,
  options?: LpsReadOptions
): Promise<T[]> {
  const params: Record<string, unknown> = { table };

  if (options?.where && options.where.length > 0) {
    params.where = options.where.map((w) => {
      const clause: Record<string, unknown> = {
        field: w.field,
        condition: w.condition,
        value: w.value,
      };
      if (w.isNumber) clause.isNumber = true;
      if (w.isEpoch) clause.isEpoch = true;
      return clause;
    });
  }

  if (options?.sort) {
    params.sort = options.sort;
  }

  if (options?.include_deleted) {
    params.include_deleted = true;
  }

  return lpsPost<T[]>({
    action: "read",
    params,
  });
}
