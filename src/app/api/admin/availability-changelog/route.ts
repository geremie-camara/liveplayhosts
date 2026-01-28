import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDb, TABLES } from "@/lib/dynamodb";
import { Role, hasPermission } from "@/lib/roles";
import { AvailabilityChangeLog } from "@/lib/types";

// GET /api/admin/availability-changelog - Get availability change history
export async function GET(request: NextRequest) {
  const user = await currentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (user.publicMetadata?.role as Role) || "applicant";
  if (!hasPermission(role, "manageUsers")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const hostId = searchParams.get("hostId"); // Optional: filter by specific host
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
  const startKey = searchParams.get("startKey");

  try {
    let result;

    if (hostId) {
      // Query for specific host's changes
      result = await dynamoDb.send(
        new QueryCommand({
          TableName: TABLES.AVAILABILITY_CHANGELOG,
          IndexName: "hostId-createdAt-index",
          KeyConditionExpression: "hostId = :hostId",
          ExpressionAttributeValues: {
            ":hostId": hostId,
          },
          ScanIndexForward: false, // Most recent first
          Limit: limit,
          ...(startKey && { ExclusiveStartKey: JSON.parse(startKey) }),
        })
      );
    } else {
      // Query all changes using the global index
      result = await dynamoDb.send(
        new QueryCommand({
          TableName: TABLES.AVAILABILITY_CHANGELOG,
          IndexName: "odIndex-createdAt-index",
          KeyConditionExpression: "odIndex = :odIndex",
          ExpressionAttributeValues: {
            ":odIndex": "ALL",
          },
          ScanIndexForward: false, // Most recent first
          Limit: limit,
          ...(startKey && { ExclusiveStartKey: JSON.parse(startKey) }),
        })
      );
    }

    const changes = (result.Items || []) as AvailabilityChangeLog[];

    return NextResponse.json({
      changes,
      nextKey: result.LastEvaluatedKey
        ? JSON.stringify(result.LastEvaluatedKey)
        : null,
    });
  } catch (error) {
    console.error("Error fetching availability changelog:", error);
    return NextResponse.json(
      { error: "Failed to fetch changelog" },
      { status: 500 }
    );
  }
}
