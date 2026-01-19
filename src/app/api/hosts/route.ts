import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ScanCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDb, TABLES } from "@/lib/dynamodb";
import { Host } from "@/lib/types";

// GET /api/hosts - List all hosts
export async function GET(request: NextRequest) {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is admin
  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get query params
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const roleFilter = searchParams.get("role");
  const search = searchParams.get("search");

  try {
    // Scan DynamoDB table
    const result = await dynamoDb.send(
      new ScanCommand({
        TableName: TABLES.HOSTS,
      })
    );

    let hosts = (result.Items || []) as Host[];

    // Apply filters
    if (status) {
      hosts = hosts.filter((h) => h.status === status);
    }

    if (roleFilter) {
      hosts = hosts.filter((h) => h.role === roleFilter);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      hosts = hosts.filter(
        (h) =>
          h.firstName.toLowerCase().includes(searchLower) ||
          h.lastName.toLowerCase().includes(searchLower) ||
          h.email.toLowerCase().includes(searchLower)
      );
    }

    // Sort by appliedAt descending
    hosts.sort(
      (a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime()
    );

    return NextResponse.json(hosts);
  } catch (error) {
    console.error("Error fetching hosts:", error);
    return NextResponse.json({ error: "Failed to fetch hosts" }, { status: 500 });
  }
}

// POST /api/hosts - Create new host (for manual entry or applications)
export async function POST(request: NextRequest) {
  const body = await request.json();

  // Check if this is a public application (no auth required) or admin action
  const { userId, sessionClaims } = await auth();
  const isAdmin = (sessionClaims?.metadata as { role?: string })?.role === "admin";

  // For non-application requests, require admin
  if (body.source !== "application" && !isAdmin) {
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date().toISOString();

  const newHost: Host = {
    id: crypto.randomUUID(),
    status: body.status || "applicant",
    role: body.role || "trainee",
    firstName: body.firstName,
    lastName: body.lastName,
    email: body.email.toLowerCase(),
    phone: body.phone,
    address: {
      street: body.street || "",
      city: body.city || "",
      state: body.state || "",
      zip: body.zip || "",
    },
    socialProfiles: {
      instagram: body.instagram || undefined,
      tiktok: body.tiktok || undefined,
      youtube: body.youtube || undefined,
      linkedin: body.linkedin || undefined,
      other: body.otherSocial || undefined,
    },
    experience: body.experience || "",
    videoReelUrl: body.videoReelUrl || undefined,
    appliedAt: now,
    createdAt: now,
    updatedAt: now,
    notes: body.notes || undefined,
  };

  try {
    await dynamoDb.send(
      new PutCommand({
        TableName: TABLES.HOSTS,
        Item: newHost,
      })
    );

    return NextResponse.json(newHost, { status: 201 });
  } catch (error) {
    console.error("Error creating host:", error);
    return NextResponse.json({ error: "Failed to create host" }, { status: 500 });
  }
}
