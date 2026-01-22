import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDb, TABLES } from "@/lib/dynamodb";
import { Section } from "@/lib/training-types";
import { UserRole } from "@/lib/types";
import { hasPermission } from "@/lib/roles";

// POST /api/admin/training/sections - Create section
export async function POST(request: NextRequest) {
  const user = await currentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = user.publicMetadata?.role as UserRole | undefined;
  if (!userRole || !hasPermission(userRole, "manageTraining")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { courseId, title, description, order } = body;

    if (!courseId || !title) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const sectionId = `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const section: Section = {
      id: sectionId,
      courseId,
      title,
      description: description || undefined,
      order: order ?? 0,
      createdAt: now,
      updatedAt: now,
    };

    await dynamoDb.send(
      new PutCommand({
        TableName: TABLES.SECTIONS,
        Item: section,
      })
    );

    return NextResponse.json(section);
  } catch (error) {
    console.error("Error creating section:", error);
    return NextResponse.json({ error: "Failed to create section" }, { status: 500 });
  }
}
