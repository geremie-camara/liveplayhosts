import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, S3_BUCKETS } from "@/lib/s3";

// GET /api/upload-url - Get pre-signed URL for upload OR viewing
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const filename = searchParams.get("filename");
  const contentType = searchParams.get("contentType");
  const viewUrl = searchParams.get("viewUrl"); // URL to get signed view URL for

  // If viewUrl is provided, generate a signed URL for viewing
  if (viewUrl) {
    try {
      // Extract the key from the S3 URL
      const urlMatch = viewUrl.match(/\.s3\.[^/]+\.amazonaws\.com\/(.+)$/);
      if (!urlMatch) {
        return NextResponse.json({ error: "Invalid S3 URL" }, { status: 400 });
      }
      const key = decodeURIComponent(urlMatch[1]);

      const command = new GetObjectCommand({
        Bucket: S3_BUCKETS.VIDEOS,
        Key: key,
      });

      // Generate signed URL valid for 1 hour
      const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

      return NextResponse.json({ signedUrl });
    } catch (error) {
      console.error("Error generating view URL:", error);
      return NextResponse.json({ error: "Failed to generate view URL" }, { status: 500 });
    }
  }

  if (!filename || !contentType) {
    return NextResponse.json(
      { error: "Missing filename or contentType" },
      { status: 400 }
    );
  }

  // Validate content type
  const videoTypes = ["video/mp4", "video/quicktime", "video/webm", "video/x-msvideo"];
  const imageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const allowedTypes = [...videoTypes, ...imageTypes];

  if (!allowedTypes.includes(contentType)) {
    return NextResponse.json(
      { error: "Invalid content type. Allowed: MP4, MOV, WebM, AVI, JPEG, PNG, WebP, GIF" },
      { status: 400 }
    );
  }

  // Generate unique key for the file
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 15);
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");

  // Use different folders for videos and images
  const folder = videoTypes.includes(contentType) ? "video-reels" : "headshots";
  const key = `${folder}/${timestamp}-${randomId}-${sanitizedFilename}`;

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
