import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDb, TABLES } from "@/lib/dynamodb";
import { Location } from "@/lib/location-types";

// GET /api/locations - List all locations (requires auth)
export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await dynamoDb.send(
      new ScanCommand({
        TableName: TABLES.LOCATIONS,
      })
    );

    const locations = (result.Items || []) as Location[];

    // Sort alphabetically by name
    locations.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(locations);
  } catch (error) {
    console.error("Error fetching locations:", error);
    return NextResponse.json(
      { error: "Failed to fetch locations" },
      { status: 500 }
    );
  }
}
