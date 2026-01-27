import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { dynamoDb, TABLES } from "@/lib/dynamodb";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { hasPermission, getUserRole } from "@/lib/roles";
import { Host, UserAvailability } from "@/lib/types";

export interface HostWithAvailability extends Host {
  availability?: UserAvailability;
}

// GET - Fetch all hosts with their availability
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check permission
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const userRole = getUserRole(user.publicMetadata);

    if (!hasPermission(userRole, "manageAvailability")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch all hosts with role = "host"
    const hostsResult = await dynamoDb.send(
      new ScanCommand({
        TableName: TABLES.HOSTS,
        FilterExpression: "#role = :role",
        ExpressionAttributeNames: { "#role": "role" },
        ExpressionAttributeValues: { ":role": "host" },
      })
    );
    const hosts = (hostsResult.Items || []) as Host[];

    // Fetch all availability records
    const availResult = await dynamoDb.send(
      new ScanCommand({
        TableName: TABLES.AVAILABILITY,
      })
    );
    const availabilities = (availResult.Items || []) as UserAvailability[];

    // Create a map of userId -> availability
    const availMap = new Map<string, UserAvailability>();
    for (const avail of availabilities) {
      availMap.set(avail.userId, avail);
    }

    // Combine hosts with their availability
    const hostsWithAvailability: HostWithAvailability[] = hosts.map((host) => ({
      ...host,
      availability: availMap.get(host.id),
    }));

    // Sort alphabetically by last name, then first name
    hostsWithAvailability.sort((a, b) => {
      const lastNameCompare = (a.lastName || "").localeCompare(b.lastName || "");
      if (lastNameCompare !== 0) return lastNameCompare;
      return (a.firstName || "").localeCompare(b.firstName || "");
    });

    return NextResponse.json({ hosts: hostsWithAvailability });
  } catch (error) {
    console.error("Error fetching host availability:", error);
    return NextResponse.json(
      { error: "Failed to fetch host availability" },
      { status: 500 }
    );
  }
}
