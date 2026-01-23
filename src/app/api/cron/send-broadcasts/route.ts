import { NextRequest, NextResponse } from "next/server";
import { processScheduledBroadcasts } from "@/lib/broadcast-sender";

// POST /api/cron/send-broadcasts - Process scheduled broadcasts
// This endpoint should be called by Vercel Cron or AWS EventBridge every 5 minutes
export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processScheduledBroadcasts();

    return NextResponse.json({
      success: true,
      processed: result.processed,
      errors: result.errors,
    });
  } catch (error) {
    console.error("Error processing scheduled broadcasts:", error);
    return NextResponse.json(
      { error: "Failed to process scheduled broadcasts" },
      { status: 500 }
    );
  }
}

// GET handler for Vercel Cron (Vercel sends GET requests to cron endpoints)
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processScheduledBroadcasts();

    return NextResponse.json({
      success: true,
      processed: result.processed,
      errors: result.errors,
    });
  } catch (error) {
    console.error("Error processing scheduled broadcasts:", error);
    return NextResponse.json(
      { error: "Failed to process scheduled broadcasts" },
      { status: 500 }
    );
  }
}
