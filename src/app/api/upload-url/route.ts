import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, S3_BUCKETS } from "@/lib/s3";

// GET /api/upload-url - Get pre-signed URL for video upload
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const filename = searchParams.get("filename");
  const contentType = searchParams.get("contentType");

  if (!filename || !contentType) {
    return NextResponse.json(
      { error: "Missing filename or contentType" },
      { status: 400 }
    );
  }

  // Validate content type
  const allowedTypes = ["video/mp4", "video/quicktime", "video/webm", "video/x-msvideo"];
  if (!allowedTypes.includes(contentType)) {
    return NextResponse.json(
      { error: "Invalid content type. Allowed: MP4, MOV, WebM, AVI" },
      { status: 400 }
    );
  }

  // Generate unique key for the file
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 15);
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
  const key = `video-reels/${timestamp}-${randomId}-${sanitizedFilename}`;

  try {
    const command = new PutObjectCommand({
      Bucket: S3_BUCKETS.VIDEOS,
      Key: key,
      ContentType: contentType,
    });

    // Generate pre-signed URL valid for 15 minutes
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

    // Construct the public URL for the file
    const fileUrl = `https://${S3_BUCKETS.VIDEOS}.s3.us-west-2.amazonaws.com/${key}`;

    return NextResponse.json({
      uploadUrl,
      fileUrl,
      key,
    });
  } catch (error) {
    console.error("Error generating upload URL:", error);
    return NextResponse.json(
      { error: "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}
