import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { mockHosts, delay } from "@/lib/mock-data";
import { Host } from "@/lib/types";

// In-memory store for development (will be replaced with DynamoDB)
let hosts: Host[] = [...mockHosts];

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

  await delay(300); // Simulate API delay

  let filteredHosts = [...hosts];

  if (status) {
    filteredHosts = filteredHosts.filter((h) => h.status === status);
  }

  if (roleFilter) {
    filteredHosts = filteredHosts.filter((h) => h.role === roleFilter);
  }

  if (search) {
    const searchLower = search.toLowerCase();
    filteredHosts = filteredHosts.filter(
      (h) =>
        h.firstName.toLowerCase().includes(searchLower) ||
        h.lastName.toLowerCase().includes(searchLower) ||
        h.email.toLowerCase().includes(searchLower)
    );
  }

  // Sort by appliedAt descending
  filteredHosts.sort(
    (a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime()
  );

  return NextResponse.json(filteredHosts);
}

// POST /api/hosts - Create new host (for manual entry)
export async function POST(request: NextRequest) {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
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
      street: body.street,
      city: body.city,
      state: body.state,
      zip: body.zip,
    },
    socialProfiles: {
      instagram: body.instagram || undefined,
      tiktok: body.tiktok || undefined,
      youtube: body.youtube || undefined,
      linkedin: body.linkedin || undefined,
      other: body.otherSocial || undefined,
    },
    experience: body.experience,
    videoReelUrl: body.videoReelUrl || undefined,
    appliedAt: now,
    createdAt: now,
    updatedAt: now,
    notes: body.notes || undefined,
  };

  hosts.push(newHost);

  return NextResponse.json(newHost, { status: 201 });
}
