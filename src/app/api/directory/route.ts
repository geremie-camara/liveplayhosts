import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDb, TABLES } from "@/lib/dynamodb";
import { Host } from "@/lib/types";
import { isActiveUser } from "@/lib/roles";

// GET /api/directory - Get all users for directory (accessible to all active users)
export async function GET(request: NextRequest) {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is active
  const userRole = (sessionClaims?.metadata as { role?: string })?.role;
  if (!isActiveUser(userRole as any)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role");
  const roles = searchParams.get("roles");
  const search = searchParams.get("search");

  try {
    let filterExpressions: string[] = [];
    let expressionAttributeValues: Record<string, unknown> = {};
    let expressionAttributeNames: Record<string, string> = {};

    // Only show active users in directory (host, producer, talent, finance, hr, admin, owner)
    filterExpressions.push("(#role = :host OR #role = :producer OR #role = :talent OR #role = :finance OR #role = :hr OR #role = :admin OR #role = :owner)");
    expressionAttributeNames["#role"] = "role";
    expressionAttributeValues[":host"] = "host";
    expressionAttributeValues[":producer"] = "producer";
    expressionAttributeValues[":talent"] = "talent";
    expressionAttributeValues[":finance"] = "finance";
    expressionAttributeValues[":hr"] = "hr";
    expressionAttributeValues[":admin"] = "admin";
    expressionAttributeValues[":owner"] = "owner";

    // Filter by specific role
    if (role) {
      filterExpressions = [`#role = :filterRole`];
      expressionAttributeValues[":filterRole"] = role;
    }

    // Filter by multiple roles
    if (roles) {
      const roleList = roles.split(",");
      const roleConditions = roleList.map((r, i) => `#role = :role${i}`);
      filterExpressions = [`(${roleConditions.join(" OR ")})`];
      roleList.forEach((r, i) => {
        expressionAttributeValues[`:role${i}`] = r;
      });
    }

    // Search filter
    if (search) {
      filterExpressions.push("(contains(#firstName, :search) OR contains(#lastName, :search) OR contains(#email, :search))");
      expressionAttributeNames["#firstName"] = "firstName";
      expressionAttributeNames["#lastName"] = "lastName";
      expressionAttributeNames["#email"] = "email";
      expressionAttributeValues[":search"] = search;
    }

    const scanParams: any = {
      TableName: TABLES.HOSTS,
    };

    if (filterExpressions.length > 0) {
      scanParams.FilterExpression = filterExpressions.join(" AND ");
      scanParams.ExpressionAttributeNames = expressionAttributeNames;
      scanParams.ExpressionAttributeValues = expressionAttributeValues;
    }

    const result = await dynamoDb.send(new ScanCommand(scanParams));
    const hosts = (result.Items || []) as Host[];

    // Include communication fields but remove sensitive notes and address details
    const safeHosts = hosts.map(host => ({
      id: host.id,
      firstName: host.firstName,
      lastName: host.lastName,
      email: host.email,
      phone: host.phone,
      location: host.location,
      role: host.role,
      slackId: host.slackId,
      slackChannelId: host.slackChannelId,
      socialProfiles: {
        instagram: host.socialProfiles?.instagram,
        tiktok: host.socialProfiles?.tiktok,
      },
      headshotUrl: host.headshotUrl,
      headshotExternalUrl: (host as any).headshotExternalUrl,
    }));

    return NextResponse.json(safeHosts);
  } catch (error) {
    console.error("Error fetching directory:", error);
    return NextResponse.json({ error: "Failed to fetch directory" }, { status: 500 });
  }
}
