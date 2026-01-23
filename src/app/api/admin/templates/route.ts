import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDb, TABLES } from "@/lib/dynamodb";
import { UserRole } from "@/lib/types";
import { hasPermission } from "@/lib/roles";
import { BroadcastTemplate, TemplateFormData } from "@/lib/broadcast-types";

// GET /api/admin/templates - List all templates
export async function GET() {
  const user = await currentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = user.publicMetadata?.role as UserRole | undefined;
  if (!userRole || !hasPermission(userRole, "manageBroadcasts")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await dynamoDb.send(
      new ScanCommand({ TableName: TABLES.BROADCAST_TEMPLATES })
    );

    const templates = (result.Items || []) as BroadcastTemplate[];

    // Sort by name
    templates.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(templates);
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 });
  }
}

// POST /api/admin/templates - Create new template
export async function POST(request: NextRequest) {
  const user = await currentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = user.publicMetadata?.role as UserRole | undefined;
  if (!userRole || !hasPermission(userRole, "manageBroadcasts")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body: TemplateFormData = await request.json();

    // Validate required fields
    if (!body.name || !body.subject || !body.bodyHtml || !body.bodySms) {
      return NextResponse.json(
        { error: "Missing required fields: name, subject, bodyHtml, bodySms" },
        { status: 400 }
      );
    }

    // Validate SMS length
    if (body.bodySms.length > 160) {
      return NextResponse.json(
        { error: "SMS body must be 160 characters or less" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const templateId = `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Get creator's host record ID
    const hostResult = await dynamoDb.send(
      new ScanCommand({
        TableName: TABLES.HOSTS,
        FilterExpression: "clerkUserId = :clerkUserId",
        ExpressionAttributeValues: {
          ":clerkUserId": user.id,
        },
      })
    );
    const creatorHostId = hostResult.Items?.[0]?.id || user.id;

    const template: BroadcastTemplate = {
      id: templateId,
      name: body.name,
      subject: body.subject,
      bodyHtml: body.bodyHtml,
      bodySms: body.bodySms,
      defaultChannels: body.defaultChannels || { slack: true, email: true, sms: false },
      defaultUserSelection: body.defaultUserSelection,
      variables: body.variables || [],
      createdBy: creatorHostId,
      createdAt: now,
      updatedAt: now,
    };

    await dynamoDb.send(
      new PutCommand({
        TableName: TABLES.BROADCAST_TEMPLATES,
        Item: template,
      })
    );

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("Error creating template:", error);
    return NextResponse.json({ error: "Failed to create template" }, { status: 500 });
  }
}
