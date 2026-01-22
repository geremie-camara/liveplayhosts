import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { GetCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDb, TABLES } from "@/lib/dynamodb";
import { Host } from "@/lib/types";
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

  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (role !== "admin") {
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

  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const now = new Date().toISOString();

  // Get current host to check status change
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
    "status", "role", "firstName", "lastName", "email", "phone",
    "address", "socialProfiles", "experience", "videoReelUrl", "headshotUrl", "notes", "clerkUserId"
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

  // Handle status change timestamps
  if (body.status === "invited") {
    updateFields.push("#invitedAt = :invitedAt");
    expressionAttributeNames["#invitedAt"] = "invitedAt";
    expressionAttributeValues[":invitedAt"] = now;
  }

  if (body.status === "active") {
    updateFields.push("#hiredAt = :hiredAt");
    expressionAttributeNames["#hiredAt"] = "hiredAt";
    expressionAttributeValues[":hiredAt"] = now;
  }

  // Check if status is changing to "active" - update Clerk metadata if user exists
  const isActivating = body.status === "active" && currentHost?.status !== "active";
  let clerkSyncMessage: string | null = null;

  if (isActivating && currentHost) {
    try {
      const clerk = await clerkClient();

      // Check if user already exists in Clerk
      const existingUsers = await clerk.users.getUserList({
        emailAddress: [currentHost.email],
      });

      if (existingUsers.data.length > 0) {
        // User already exists - update their role metadata
        const existingUser = existingUsers.data[0];
        await clerk.users.updateUser(existingUser.id, {
          publicMetadata: {
            role: body.role || currentHost.role || "trainee",
          },
        });

        // Store Clerk user ID
        updateFields.push("#clerkUserId = :clerkUserId");
        expressionAttributeNames["#clerkUserId"] = "clerkUserId";
        expressionAttributeValues[":clerkUserId"] = existingUser.id;

        clerkSyncMessage = "Role synced to existing Clerk account.";
      } else {
        // User doesn't exist in Clerk yet - they'll be synced on first login
        clerkSyncMessage = "Host activated. Role will sync when they sign in with Google/Slack.";
      }

      // Send welcome email via Resend
      if (process.env.RESEND_API_KEY) {
        const resend = new Resend(process.env.RESEND_API_KEY);
        try {
          await resend.emails.send({
            from: "LivePlay Hosts <onboarding@resend.dev>",
            to: [currentHost.email],
            subject: "Welcome to LivePlay Hosts - You're Activated!",
            html: `
              <h2>Congratulations, ${currentHost.firstName}!</h2>
              <p>Your application to become a LivePlay Host has been approved!</p>
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
      clerkSyncMessage = "Host activated. Role will sync when they sign in.";
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

  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (role !== "admin") {
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
