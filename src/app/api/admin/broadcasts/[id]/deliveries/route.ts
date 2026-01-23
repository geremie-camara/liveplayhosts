import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDb, TABLES } from "@/lib/dynamodb";
import { UserRole } from "@/lib/types";
import { hasPermission } from "@/lib/roles";
import { getBroadcastDeliveries } from "@/lib/broadcast-sender";

// GET /api/admin/broadcasts/[id]/deliveries - Get delivery details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await currentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = user.publicMetadata?.role as UserRole | undefined;
  if (!userRole || !hasPermission(userRole, "manageBroadcasts")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    // Check if broadcast exists
    const broadcastResult = await dynamoDb.send(
      new GetCommand({
        TableName: TABLES.BROADCASTS,
        Key: { id },
      })
    );

    if (!broadcastResult.Item) {
      return NextResponse.json({ error: "Broadcast not found" }, { status: 404 });
    }

    // Get deliveries
    const deliveries = await getBroadcastDeliveries(id);

    // Parse pagination params
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const statusFilter = searchParams.get("status"); // "delivered", "failed", "read"

    // Apply status filter
    let filtered = deliveries;
    if (statusFilter === "delivered") {
      filtered = deliveries.filter(
        (d) => d.slack.status === "sent" || d.email.status === "sent" || d.sms.status === "sent"
      );
    } else if (statusFilter === "failed") {
      filtered = deliveries.filter(
        (d) => d.slack.status === "failed" || d.email.status === "failed" || d.sms.status === "failed"
      );
    } else if (statusFilter === "read") {
      filtered = deliveries.filter((d) => !!d.readAt);
    } else if (statusFilter === "unread") {
      filtered = deliveries.filter((d) => !d.readAt);
    }

    // Paginate
    const total = filtered.length;
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginated = filtered.slice(start, end);

    return NextResponse.json({
      deliveries: paginated,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching deliveries:", error);
    return NextResponse.json({ error: "Failed to fetch deliveries" }, { status: 500 });
  }
}
