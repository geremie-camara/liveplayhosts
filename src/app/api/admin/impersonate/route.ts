import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { Role, isAdmin } from "@/lib/roles";
import {
  GHOST_COOKIE_NAME,
  GHOST_COOKIE_MAX_AGE,
  getHostById,
  getGhostHostId,
} from "@/lib/host-utils";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

// POST /api/admin/impersonate — Start impersonation
export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = user.publicMetadata?.role as Role | undefined;
  if (!isAdmin(userRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { hostId } = body as { hostId?: string };

  if (!hostId) {
    return NextResponse.json({ error: "hostId is required" }, { status: 400 });
  }

  // Verify the target host exists
  const targetHost = await getHostById(hostId);
  if (!targetHost) {
    return NextResponse.json({ error: "Host not found" }, { status: 404 });
  }

  // Set the ghost cookie
  const cookieStore = await cookies();
  cookieStore.set(GHOST_COOKIE_NAME, hostId, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "lax",
    path: "/",
    maxAge: GHOST_COOKIE_MAX_AGE,
  });

  // Audit log
  console.log(
    `[GHOST START] Admin ${user.id} (${user.emailAddresses[0]?.emailAddress}) ` +
    `started viewing as host ${targetHost.id} ` +
    `(${targetHost.firstName} ${targetHost.lastName}, ${targetHost.email})`
  );

  return NextResponse.json({
    success: true,
    host: {
      id: targetHost.id,
      firstName: targetHost.firstName,
      lastName: targetHost.lastName,
      email: targetHost.email,
      role: targetHost.role,
    },
  });
}

// GET /api/admin/impersonate — Check current impersonation status
export async function GET() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = user.publicMetadata?.role as Role | undefined;
  if (!isAdmin(userRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ghostHostId = await getGhostHostId();
  if (!ghostHostId) {
    return NextResponse.json({ active: false });
  }

  const host = await getHostById(ghostHostId);
  if (!host) {
    return NextResponse.json({ active: false });
  }

  return NextResponse.json({
    active: true,
    host: {
      id: host.id,
      firstName: host.firstName,
      lastName: host.lastName,
      email: host.email,
      role: host.role,
    },
  });
}

// DELETE /api/admin/impersonate — Stop impersonation
export async function DELETE() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = user.publicMetadata?.role as Role | undefined;
  if (!isAdmin(userRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Read current ghost host for audit log before clearing
  const ghostHostId = await getGhostHostId();

  // Clear the cookie
  const cookieStore = await cookies();
  cookieStore.set(GHOST_COOKIE_NAME, "", {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  // Audit log
  if (ghostHostId) {
    const targetHost = await getHostById(ghostHostId);
    console.log(
      `[GHOST STOP] Admin ${user.id} (${user.emailAddresses[0]?.emailAddress}) ` +
      `stopped viewing as host ${ghostHostId}` +
      (targetHost ? ` (${targetHost.firstName} ${targetHost.lastName}, ${targetHost.email})` : "")
    );
  }

  return NextResponse.json({ success: true });
}
