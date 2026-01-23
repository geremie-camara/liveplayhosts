import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { s3Client, S3_BUCKETS } from "@/lib/s3";

export interface VideoItem {
  key: string;
  url: string;
  name: string;
  size: number;
  lastModified: string;
}

// GET /api/admin/videos - List all broadcast videos
export async function GET(request: NextRequest) {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = (sessionClaims?.metadata as { role?: string })?.role;
  if (!["admin", "owner", "talent"].includes(userRole || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const folder = searchParams.get("folder") || "broadcast-videos";

  try {
    const command = new ListObjectsV2Command({
      Bucket: S3_BUCKETS.VIDEOS,
      Prefix: `${folder}/`,
    });

    const response = await s3Client.send(command);

    const videos: VideoItem[] = (response.Contents || [])
      .filter((item) => {
        // Filter out folder placeholder and non-video files
        const key = item.Key || "";
        return (
          key !== `${folder}/` &&
          (key.endsWith(".mp4") ||
            key.endsWith(".mov") ||
            key.endsWith(".webm") ||
            key.endsWith(".avi"))
        );
      })
      .map((item) => {
        const key = item.Key || "";
        const filename = key.split("/").pop() || "";
        // Extract original filename (remove timestamp-randomId prefix)
        const nameParts = filename.split("-");
        const originalName = nameParts.length > 2 ? nameParts.slice(2).join("-") : filename;

        return {
          key,
          url: `https://${S3_BUCKETS.VIDEOS}.s3.us-west-2.amazonaws.com/${key}`,
          name: originalName,
          size: item.Size || 0,
          lastModified: item.LastModified?.toISOString() || "",
        };
      })
      .sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());

    return NextResponse.json({ videos });
  } catch (error) {
    console.error("Error listing videos:", error);
    return NextResponse.json(
      { error: "Failed to list videos" },
      { status: 500 }
    );
  }
}
