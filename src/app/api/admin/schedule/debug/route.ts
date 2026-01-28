import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { hasPermission } from "@/lib/roles";

// GET /api/admin/schedule/debug - Debug env vars (admin only)
export async function GET() {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = (sessionClaims?.metadata as { role?: string })?.role;
  if (!hasPermission(userRole as Parameters<typeof hasPermission>[0], "manageSchedule")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Check env vars without exposing full values
  const envCheck = {
    GOOGLE_SERVICE_ACCOUNT_EMAIL: {
      exists: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      length: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.length || 0,
      preview: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.substring(0, 20) + "..." || "NOT SET",
    },
    GOOGLE_PRIVATE_KEY: {
      exists: !!process.env.GOOGLE_PRIVATE_KEY,
      length: process.env.GOOGLE_PRIVATE_KEY?.length || 0,
      startsWithBegin: process.env.GOOGLE_PRIVATE_KEY?.startsWith("-----BEGIN") || false,
      containsNewlines: process.env.GOOGLE_PRIVATE_KEY?.includes("\n") || false,
      containsEscapedNewlines: process.env.GOOGLE_PRIVATE_KEY?.includes("\\n") || false,
    },
    GOOGLE_CALENDAR_MAIN_ROOM: {
      exists: !!process.env.GOOGLE_CALENDAR_MAIN_ROOM,
      length: process.env.GOOGLE_CALENDAR_MAIN_ROOM?.length || 0,
      preview: process.env.GOOGLE_CALENDAR_MAIN_ROOM?.substring(0, 20) + "..." || "NOT SET",
    },
    GOOGLE_CALENDAR_SPEED_BINGO: {
      exists: !!process.env.GOOGLE_CALENDAR_SPEED_BINGO,
      length: process.env.GOOGLE_CALENDAR_SPEED_BINGO?.length || 0,
      preview: process.env.GOOGLE_CALENDAR_SPEED_BINGO?.substring(0, 20) + "..." || "NOT SET",
    },
    GOOGLE_CALENDAR_BREAK: {
      exists: !!process.env.GOOGLE_CALENDAR_BREAK,
      length: process.env.GOOGLE_CALENDAR_BREAK?.length || 0,
      preview: process.env.GOOGLE_CALENDAR_BREAK?.substring(0, 20) + "..." || "NOT SET",
    },
  };

  // List all env var keys that start with GOOGLE_
  const allGoogleEnvKeys = Object.keys(process.env).filter(key => key.startsWith("GOOGLE_"));

  return NextResponse.json({
    envCheck,
    allGoogleEnvKeys,
    nodeEnv: process.env.NODE_ENV,
  });
}
