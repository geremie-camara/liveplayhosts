import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { dynamoDb, TABLES } from "@/lib/dynamodb";
import { PutCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { CallOut } from "@/lib/schedule-types";
import { Host } from "@/lib/types";
import { randomUUID } from "crypto";

// Helper to get host by clerkUserId
async function getHostByClerkId(clerkUserId: string): Promise<Host | null> {
  try {
    const result = await dynamoDb.send(
      new ScanCommand({
        TableName: TABLES.HOSTS,
        FilterExpression: "clerkUserId = :clerkUserId",
        ExpressionAttributeValues: {
          ":clerkUserId": clerkUserId,
        },
        Limit: 1,
      })
    );
    return (result.Items?.[0] as Host) || null;
  } catch {
    return null;
  }
}

// GET - Fetch user's call out requests
export async function GET(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Look up host by clerkUserId
    const host = await getHostByClerkId(clerkUserId);
    if (!host) {
      return NextResponse.json({ callouts: [] });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // Optional filter by status

    // Query call outs for this host
    const params: {
      TableName: string;
      IndexName: string;
      KeyConditionExpression: string;
      FilterExpression?: string;
      ExpressionAttributeValues: Record<string, string>;
    } = {
      TableName: TABLES.CALLOUTS,
      IndexName: "hostId-createdAt-index",
      KeyConditionExpression: "hostId = :hostId",
      ExpressionAttributeValues: {
        ":hostId": host.id,
      },
    };

    if (status) {
      params.FilterExpression = "#status = :status";
      params.ExpressionAttributeValues[":status"] = status;
      // @ts-expect-error - adding ExpressionAttributeNames dynamically
      params.ExpressionAttributeNames = { "#status": "status" };
    }

    const result = await dynamoDb.send(new QueryCommand(params));
    const callouts = (result.Items || []) as CallOut[];

    return NextResponse.json({ callouts });
  } catch (error) {
    console.error("Error fetching call outs:", error);
    return NextResponse.json(
      { error: "Failed to fetch call outs" },
      { status: 500 }
    );
  }
}

// POST - Submit new call out request(s)
export async function POST(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Look up host by clerkUserId
    const host = await getHostByClerkId(clerkUserId);
    if (!host) {
      return NextResponse.json({ error: "Host record not found" }, { status: 404 });
    }

    const body = await request.json();
    const { shifts } = body as {
      shifts: Array<{
        shiftId: number;
        shiftDate: string;
        shiftTime: string;
        studioName: string;
        startingOn: string;
      }>;
    };

    if (!shifts || !Array.isArray(shifts) || shifts.length === 0) {
      return NextResponse.json(
        { error: "No shifts provided" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const createdCallouts: CallOut[] = [];

    // Create a call out record for each shift
    for (const shift of shifts) {
      const callout: CallOut = {
        id: randomUUID(),
        hostId: host.id,
        shiftId: shift.shiftId,
        shiftDate: shift.startingOn,
        shiftTime: shift.shiftTime,
        studioName: shift.studioName,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      };

      await dynamoDb.send(
        new PutCommand({
          TableName: TABLES.CALLOUTS,
          Item: callout,
        })
      );

      createdCallouts.push(callout);
    }

    return NextResponse.json({
      success: true,
      callouts: createdCallouts,
      message: `Call out submitted for ${shifts.length} shift(s)`,
    });
  } catch (error) {
    console.error("Error submitting call out:", error);
    return NextResponse.json(
      { error: "Failed to submit call out" },
      { status: 500 }
    );
  }
}
