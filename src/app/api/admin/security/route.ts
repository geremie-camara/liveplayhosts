import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { dynamoDb, TABLES } from "@/lib/dynamodb";
import { ScanCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { invalidatePermissionCache } from "@/lib/roles";
import { PERMISSION_FEATURES, DEFAULT_DISPLAY_GROUPS, DISPLAY_GROUPS } from "@/lib/security-types";
import type { PermissionKey, PermissionEntry, RoleDisplayGroup, RolePermissionRecord } from "@/lib/security-types";
import type { Role } from "@/lib/roles";
import { PERMISSIONS } from "@/lib/roles";

// Roles that cannot be saved via this endpoint
const PROTECTED_ROLES = ["owner", "applicant", "rejected"];

// Build default permissions from hardcoded PERMISSIONS for a given role
function buildDefaultPermissions(role: Role): Record<PermissionKey, PermissionEntry> {
  const perms: Partial<Record<PermissionKey, PermissionEntry>> = {};

  for (const feature of PERMISSION_FEATURES) {
    // Determine read access from hardcoded mapping
    let hasRead = false;
    let hasWrite = false;

    switch (feature.key) {
      case "dashboard":
        hasRead = PERMISSIONS.viewDashboard.includes(role);
        break;
      case "messages":
        hasRead = PERMISSIONS.viewMessages.includes(role);
        break;
      case "availability":
        // All active users can view/edit own availability
        hasRead = PERMISSIONS.viewDashboard.includes(role);
        hasWrite = PERMISSIONS.viewDashboard.includes(role);
        break;
      case "training":
        hasRead = PERMISSIONS.viewBasicTraining.includes(role);
        break;
      case "schedule":
        hasRead = PERMISSIONS.viewSchedule.includes(role);
        break;
      case "finance":
        hasRead = PERMISSIONS.viewFinance.includes(role);
        hasWrite = PERMISSIONS.viewFinance.includes(role);
        break;
      case "profile":
        hasRead = PERMISSIONS.viewDashboard.includes(role);
        hasWrite = PERMISSIONS.viewDashboard.includes(role);
        break;
      case "directory":
        hasRead = PERMISSIONS.viewDashboard.includes(role);
        break;
      case "manageUsers":
        hasRead = PERMISSIONS.manageUsers.includes(role);
        hasWrite = PERMISSIONS.manageUsers.includes(role);
        break;
      case "callOuts":
        hasRead = PERMISSIONS.manageCallOuts.includes(role);
        hasWrite = PERMISSIONS.manageCallOuts.includes(role);
        break;
      case "hostPriority":
        hasRead = PERMISSIONS.manageHostPriority.includes(role);
        hasWrite = PERMISSIONS.manageHostPriority.includes(role);
        break;
      case "hostAvailability":
        hasRead = PERMISSIONS.manageAvailability.includes(role);
        hasWrite = PERMISSIONS.manageAvailability.includes(role);
        break;
      case "availabilityChangelog":
        hasRead = PERMISSIONS.manageAvailability.includes(role);
        break;
      case "calendarSync":
        hasRead = PERMISSIONS.manageSchedule.includes(role);
        hasWrite = PERMISSIONS.manageSchedule.includes(role);
        break;
      case "broadcasts":
        hasRead = PERMISSIONS.manageBroadcasts.includes(role);
        hasWrite = PERMISSIONS.manageBroadcasts.includes(role);
        break;
      case "trainingContent":
        hasRead = PERMISSIONS.viewAllTraining.includes(role);
        hasWrite = PERMISSIONS.manageTraining.includes(role);
        break;
      case "locations":
        hasRead = PERMISSIONS.manageLocations.includes(role);
        hasWrite = PERMISSIONS.manageLocations.includes(role);
        break;
      case "analytics":
        hasRead = PERMISSIONS.viewAnalytics.includes(role);
        break;
    }

    perms[feature.key] = { read: hasRead, write: hasWrite };
  }

  return perms as Record<PermissionKey, PermissionEntry>;
}

// GET — Load all role permissions (owner only)
export async function GET() {
  try {
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (sessionClaims?.metadata as { role?: string })?.role;
    if (userRole !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Scan DynamoDB for all role permission records
    const result = await dynamoDb.send(
      new ScanCommand({ TableName: TABLES.ROLE_PERMISSIONS })
    );

    const records: RolePermissionRecord[] = [];

    if (result.Items && result.Items.length > 0) {
      for (const item of result.Items) {
        records.push(item as unknown as RolePermissionRecord);
      }
    }

    // For any editable roles not in DynamoDB, build defaults from hardcoded permissions
    const editableRoles: Role[] = ["host", "producer", "talent", "finance", "hr", "admin"];
    const existingRoles = new Set(records.map((r) => r.role));

    for (const role of editableRoles) {
      if (!existingRoles.has(role)) {
        records.push({
          role,
          permissions: buildDefaultPermissions(role),
          displayGroup: DEFAULT_DISPLAY_GROUPS[role] || "Hosts",
          updatedAt: "",
          updatedBy: "",
          updatedByName: "System Default",
        });
      }
    }

    // Add owner as a special locked entry (all permissions true)
    const ownerPerms: Partial<Record<PermissionKey, PermissionEntry>> = {};
    for (const feature of PERMISSION_FEATURES) {
      ownerPerms[feature.key] = { read: true, write: !feature.readOnly };
    }
    records.push({
      role: "owner",
      permissions: ownerPerms as Record<PermissionKey, PermissionEntry>,
      displayGroup: "Management",
      updatedAt: "",
      updatedBy: "",
      updatedByName: "System (locked)",
    });

    return NextResponse.json({ records });
  } catch (error) {
    console.error("[security API] GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT — Save permissions for a single role (owner only)
export async function PUT(request: NextRequest) {
  try {
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (sessionClaims?.metadata as { role?: string })?.role;
    if (userRole !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { role, permissions, displayGroup, updatedByName } = body as {
      role: string;
      permissions: Record<PermissionKey, PermissionEntry>;
      displayGroup: RoleDisplayGroup;
      updatedByName: string;
    };

    // Validate role
    if (!role || PROTECTED_ROLES.includes(role)) {
      return NextResponse.json(
        { error: `Cannot modify permissions for role: ${role}` },
        { status: 400 }
      );
    }

    // Validate display group
    if (!DISPLAY_GROUPS.includes(displayGroup)) {
      return NextResponse.json(
        { error: `Invalid display group: ${displayGroup}` },
        { status: 400 }
      );
    }

    // Validate permissions object has valid keys
    const validKeys = new Set(PERMISSION_FEATURES.map((f) => f.key));
    for (const key of Object.keys(permissions)) {
      if (!validKeys.has(key as PermissionKey)) {
        return NextResponse.json(
          { error: `Invalid permission key: ${key}` },
          { status: 400 }
        );
      }
    }

    // Look up the host record to get host.id for audit
    const { ScanCommand: ScanCmd } = await import("@aws-sdk/lib-dynamodb");
    const hostResult = await dynamoDb.send(
      new ScanCmd({
        TableName: TABLES.HOSTS,
        FilterExpression: "clerkUserId = :clerkId",
        ExpressionAttributeValues: { ":clerkId": userId },
        Limit: 1,
      })
    );
    const hostId = hostResult.Items?.[0]?.id || userId;

    const record: RolePermissionRecord = {
      role,
      permissions,
      displayGroup,
      updatedAt: new Date().toISOString(),
      updatedBy: hostId as string,
      updatedByName: updatedByName || "Unknown",
    };

    await dynamoDb.send(
      new PutCommand({
        TableName: TABLES.ROLE_PERMISSIONS,
        Item: record,
      })
    );

    // Invalidate the in-memory cache so changes take effect immediately
    invalidatePermissionCache();

    return NextResponse.json({ success: true, record });
  } catch (error) {
    console.error("[security API] PUT error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
