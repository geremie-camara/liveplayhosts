import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { GetCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDb, TABLES } from "@/lib/dynamodb";
import { Host, UserRole } from "@/lib/types";
import { ACTIVE_ROLES } from "@/lib/roles";
import { Resend } from "resend";

// GET /api/hosts/[id] - Get single host
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = (sessionClaims?.metadata as { role?: string })?.role;
  if (userRole !== "admin" && userRole !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const result = await dynamoDb.send(
      new GetCommand({
        TableName: TABLES.HOSTS,
        Key: { id },
      })
    );

    if (!result.Item) {
      return NextResponse.json({ error: "Host not found" }, { status: 404 });
    }

    return NextResponse.json(result.Item as Host);
  } catch (error) {
    console.error("Error fetching host:", error);
    return NextResponse.json({ error: "Failed to fetch host" }, { status: 500 });
  }
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

  const userRole = (sessionClaims?.metadata as { role?: string })?.role;
  if (userRole !== "admin" && userRole !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const now = new Date().toISOString();

  // Get current host to check role change
  const currentHostResult = await dynamoDb.send(
    new GetCommand({
      TableName: TABLES.HOSTS,
      Key: { id },
    })
  );
  const currentHost = currentHostResult.Item as Host | undefined;

  // Build update expression dynamically
  const updateFields: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, unknown> = {};

  // Fields that can be updated
  const allowedFields = [
    "role", "firstName", "lastName", "email", "phone", "location",
    "address", "socialProfiles", "experience", "videoReelUrl", "headshotUrl", "headshotExternalUrl", "notes", "clerkUserId",
    "slackId", "slackChannelId"
  ];

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateFields.push(`#${field} = :${field}`);
      expressionAttributeNames[`#${field}`] = field;
      expressionAttributeValues[`:${field}`] = body[field];
    }
  }

  // Always update updatedAt
  updateFields.push("#updatedAt = :updatedAt");
  expressionAttributeNames["#updatedAt"] = "updatedAt";
  expressionAttributeValues[":updatedAt"] = now;

  // Handle role change timestamps - set hiredAt when user is approved (moved to an active role)
  const newRole = body.role as UserRole | undefined;
  const currentRole = currentHost?.role;
  const isBeingApproved = newRole &&
    ACTIVE_ROLES.includes(newRole) &&
    currentRole &&
    !ACTIVE_ROLES.includes(currentRole);

  if (isBeingApproved) {
    updateFields.push("#hiredAt = :hiredAt");
    expressionAttributeNames["#hiredAt"] = "hiredAt";
    expressionAttributeValues[":hiredAt"] = now;
  }

  // Sync role to Clerk whenever it changes
  let clerkSyncMessage: string | null = null;
  const roleChanged = newRole && currentRole && newRole !== currentRole;

  if (roleChanged && currentHost) {
    try {
      const clerk = await clerkClient();

      // Check if user exists in Clerk
      const existingUsers = await clerk.users.getUserList({
        emailAddress: [currentHost.email],
      });

      if (existingUsers.data.length > 0) {
        // User exists - update their role metadata
        const existingUser = existingUsers.data[0];
        await clerk.users.updateUser(existingUser.id, {
          publicMetadata: {
            role: newRole,
          },
        });

        // Store Clerk user ID if not already set
        if (!currentHost.clerkUserId) {
          updateFields.push("#clerkUserId = :clerkUserId");
          expressionAttributeNames["#clerkUserId"] = "clerkUserId";
          expressionAttributeValues[":clerkUserId"] = existingUser.id;
        }

        clerkSyncMessage = `Role updated to ${newRole} and synced to Clerk.`;
      } else {
        // User doesn't exist in Clerk yet
        clerkSyncMessage = `Role updated to ${newRole}. Will sync when user signs in.`;
      }

      // Send welcome email only on first approval (non-active to active)
      if (isBeingApproved && process.env.RESEND_API_KEY) {
        const resend = new Resend(process.env.RESEND_API_KEY);
        try {
          await resend.emails.send({
            from: "LivePlay Hosts <onboarding@resend.dev>",
            to: [currentHost.email],
            subject: "Welcome to LivePlay Hosts - You're Approved!",
            html: `
              <h2>Congratulations, ${currentHost.firstName}!</h2>
              <p>Your application to join LivePlay Hosts has been approved!</p>
              <p>You can now log in at <a href="https://www.liveplayhosts.com/sign-in">liveplayhosts.com</a> using Google or Slack to access your dashboard.</p>
              <p>Welcome to the team!</p>
              <hr />
              <p>The LivePlay Hosts Team</p>
            `,
          });
        } catch (emailError) {
          console.error("Failed to send welcome email:", emailError);
        }
      }
    } catch (error) {
      console.error("Error syncing with Clerk:", error);
      clerkSyncMessage = `Role updated to ${newRole}. Clerk sync will happen on next sign in.`;
    }
  }

  try {
    const result = await dynamoDb.send(
      new UpdateCommand({
        TableName: TABLES.HOSTS,
        Key: { id },
        UpdateExpression: `SET ${updateFields.join(", ")}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: "ALL_NEW",
      })
    );

    const response: { host: Host; message?: string } = {
      host: result.Attributes as Host,
    };

    if (clerkSyncMessage) {
      response.message = clerkSyncMessage;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error updating host:", error);
    return NextResponse.json({ error: "Failed to update host" }, { status: 500 });
  }
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

  const userRole = (sessionClaims?.metadata as { role?: string })?.role;
  if (userRole !== "admin" && userRole !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await dynamoDb.send(
      new DeleteCommand({
        TableName: TABLES.HOSTS,
        Key: { id },
      })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting host:", error);
    return NextResponse.json({ error: "Failed to delete host" }, { status: 500 });
  }
}
