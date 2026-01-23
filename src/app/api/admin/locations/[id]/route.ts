import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { GetCommand, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDb, TABLES } from "@/lib/dynamodb";
import { Location, LocationFormData } from "@/lib/location-types";

// GET /api/admin/locations/[id] - Get single location
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
      new GetCommand({
        TableName: TABLES.LOCATIONS,
        Key: { id },
      })
    );

    if (!result.Item) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    return NextResponse.json(result.Item as Location);
  } catch (error) {
    console.error("Error fetching location:", error);
    return NextResponse.json(
      { error: "Failed to fetch location" },
      { status: 500 }
    );
  }
}

// PUT /api/admin/locations/[id] - Update location
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = (sessionClaims?.metadata as { role?: string })?.role;
  if (!["admin", "owner", "talent"].includes(userRole || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Check if location exists
    const existing = await dynamoDb.send(
      new GetCommand({
        TableName: TABLES.LOCATIONS,
        Key: { id },
      })
    );

    if (!existing.Item) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    const body: LocationFormData = await request.json();

    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (!body.country?.trim()) {
      return NextResponse.json({ error: "Country is required" }, { status: 400 });
    }

    const location: Location = {
      ...(existing.Item as Location),
      name: body.name.trim(),
      country: body.country.trim(),
      updatedAt: new Date().toISOString(),
    };

    await dynamoDb.send(
      new PutCommand({
        TableName: TABLES.LOCATIONS,
        Item: location,
      })
    );

    return NextResponse.json(location);
  } catch (error) {
    console.error("Error updating location:", error);
    return NextResponse.json(
      { error: "Failed to update location" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/locations/[id] - Delete location
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = (sessionClaims?.metadata as { role?: string })?.role;
  if (!["admin", "owner", "talent"].includes(userRole || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Check if location exists
    const existing = await dynamoDb.send(
      new GetCommand({
        TableName: TABLES.LOCATIONS,
        Key: { id },
      })
    );

    if (!existing.Item) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    await dynamoDb.send(
      new DeleteCommand({
        TableName: TABLES.LOCATIONS,
        Key: { id },
      })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting location:", error);
    return NextResponse.json(
      { error: "Failed to delete location" },
      { status: 500 }
    );
  }
}
