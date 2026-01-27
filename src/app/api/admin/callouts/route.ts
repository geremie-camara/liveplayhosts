import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { dynamoDb, TABLES } from "@/lib/dynamodb";
import { ScanCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { CallOut } from "@/lib/schedule-types";
import { Host } from "@/lib/types";

// Extended CallOut type with user details
export interface CallOutWithUser extends CallOut {
  userName?: string;
  userEmail?: string;
}

// GET - Fetch all call outs (admin only)
export async function GET(request: NextRequest) {
  try {
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin/owner/talent/producer
    const userRole = (sessionClaims?.metadata as { role?: string })?.role;
    const allowedRoles = ["admin", "owner", "talent", "producer"];
    if (!userRole || !allowedRoles.includes(userRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // Optional filter by status

    let callouts: CallOut[] = [];

    if (status) {
      // Query by status using GSI
      const result = await dynamoDb.send(
        new QueryCommand({
          TableName: TABLES.CALLOUTS,
          IndexName: "status-createdAt-index",
          KeyConditionExpression: "#status = :status",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: { ":status": status },
          ScanIndexForward: false, // Most recent first
        })
      );
      callouts = (result.Items || []) as CallOut[];
    } else {
      // Scan all call outs
      const result = await dynamoDb.send(
        new ScanCommand({
          TableName: TABLES.CALLOUTS,
        })
      );
      callouts = (result.Items || []) as CallOut[];
      // Sort by createdAt descending
      callouts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    // Fetch all hosts to get user details
    const hostsResult = await dynamoDb.send(
      new ScanCommand({
        TableName: TABLES.HOSTS,
      })
    );
    const hosts = (hostsResult.Items || []) as Host[];
    const hostsByClerkId = new Map<string, Host>();
    hosts.forEach(h => {
      if (h.clerkUserId) {
        hostsByClerkId.set(h.clerkUserId, h);
      }
    });

    // Enrich call outs with user details
    const calloutsWithUsers: CallOutWithUser[] = callouts.map(callout => {
      const host = hostsByClerkId.get(callout.userId);
      return {
        ...callout,
        userName: host ? `${host.firstName} ${host.lastName}` : "Unknown User",
        userEmail: host?.email || "",
      };
    });

    return NextResponse.json({ callouts: calloutsWithUsers });
  } catch (error) {
    console.error("Error fetching call outs:", error);
    return NextResponse.json(
      { error: "Failed to fetch call outs" },
      { status: 500 }
    );
  }
}
