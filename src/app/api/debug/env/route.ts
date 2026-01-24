import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";

// GET /api/debug/env - Check environment variables (admin only)
export async function GET() {
  const user = await currentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = user.publicMetadata?.role as string | undefined;
  if (!userRole || !["admin", "owner"].includes(userRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN ? `${process.env.SLACK_BOT_TOKEN.substring(0, 15)}...` : "NOT SET",
    RESEND_API_KEY: process.env.RESEND_API_KEY ? "SET" : "NOT SET",
    S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID ? "SET" : "NOT SET",
    S3_REGION: process.env.S3_REGION || "NOT SET",
  });
}
