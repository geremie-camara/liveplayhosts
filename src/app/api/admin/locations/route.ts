import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ScanCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDb, TABLES } from "@/lib/dynamodb";
import { Location, LocationFormData } from "@/lib/location-types";

// GET /api/admin/locations - List all locations
export async function GET() {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = (sessionClaims?.metadata as { role?: string })?.role;
  if (!["admin", "owner", "talent"].includes(userRole || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await dynamoDb.send(
      new ScanCommand({
        TableName: TABLES.LOCATIONS,
      })
    );

    const locations = (result.Items || []) as Location[];
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

// POST /api/admin/locations - Create new location
export async function POST(request: NextRequest) {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = (sessionClaims?.metadata as { role?: string })?.role;
  if (!["admin", "owner", "talent"].includes(userRole || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body: LocationFormData = await request.json();

    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (!body.country?.trim()) {
      return NextResponse.json({ error: "Country is required" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const id = `loc-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    const location: Location = {
      id,
      name: body.name.trim(),
      country: body.country.trim(),
      createdAt: now,
      updatedAt: now,
    };

    await dynamoDb.send(
      new PutCommand({
        TableName: TABLES.LOCATIONS,
        Item: location,
      })
    );

    return NextResponse.json(location, { status: 201 });
  } catch (error) {
    console.error("Error creating location:", error);
    return NextResponse.json(
      { error: "Failed to create location" },
      { status: 500 }
    );
  }
}
