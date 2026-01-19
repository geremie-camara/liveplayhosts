import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { mockHosts, delay } from "@/lib/mock-data";
import { Host } from "@/lib/types";

// In-memory store for development
let hosts: Host[] = [...mockHosts];

// GET /api/hosts/[id] - Get single host
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await delay(200);

  const host = hosts.find((h) => h.id === id);

  if (!host) {
    return NextResponse.json({ error: "Host not found" }, { status: 404 });
  }

  return NextResponse.json(host);
}

// PUT /api/hosts/[id] - Update host
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  const hostIndex = hosts.findIndex((h) => h.id === id);

  if (hostIndex === -1) {
    return NextResponse.json({ error: "Host not found" }, { status: 404 });
  }

  const now = new Date().toISOString();

  // Update host
  hosts[hostIndex] = {
    ...hosts[hostIndex],
    ...body,
    address: body.address || hosts[hostIndex].address,
    socialProfiles: body.socialProfiles || hosts[hostIndex].socialProfiles,
    updatedAt: now,
    // Set timestamps based on status changes
    invitedAt: body.status === "invited" && !hosts[hostIndex].invitedAt
      ? now
      : hosts[hostIndex].invitedAt,
    hiredAt: body.status === "active" && !hosts[hostIndex].hiredAt
      ? now
      : hosts[hostIndex].hiredAt,
  };

  return NextResponse.json(hosts[hostIndex]);
}

// DELETE /api/hosts/[id] - Delete host
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const hostIndex = hosts.findIndex((h) => h.id === id);

  if (hostIndex === -1) {
    return NextResponse.json({ error: "Host not found" }, { status: 404 });
  }

  hosts.splice(hostIndex, 1);

  return NextResponse.json({ success: true });
}
