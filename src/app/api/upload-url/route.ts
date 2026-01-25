import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, S3_BUCKETS } from "@/lib/s3";

// GET /api/upload-url - Get pre-signed URL for upload OR viewing
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const filename = searchParams.get("filename");
  const contentType = searchParams.get("contentType");
  const viewUrl = searchParams.get("viewUrl"); // URL to get signed view URL for
  const folderParam = searchParams.get("folder");

  // Admin folder uploads require admin authentication
  if (folderParam === "training-videos" || folderParam === "broadcast-videos" || folderParam === "broadcast-images") {
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userRole = (sessionClaims?.metadata as { role?: string })?.role;
    if (!["admin", "owner", "talent"].includes(userRole || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Viewing signed URLs requires authentication
  if (viewUrl) {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

  // Use different folders based on content type and optional folder parameter
  let folder: string;

  if (folderParam === "training-videos") {
    folder = "training-videos";
  } else if (folderParam === "broadcast-videos") {
    folder = "broadcast-videos";
  } else if (folderParam === "broadcast-images") {
    folder = "broadcast-images";
  } else if (videoTypes.includes(contentType)) {
    folder = "video-reels";
  } else {
    folder = "headshots";
  }

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

// POST /api/upload-url - Same as GET but accepts JSON body
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { fileName, fileType, folder: folderParam } = body;

  // Admin folder uploads require admin authentication
  if (folderParam === "training-videos" || folderParam === "broadcast-videos" || folderParam === "broadcast-images") {
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userRole = (sessionClaims?.metadata as { role?: string })?.role;
    if (!["admin", "owner", "talent"].includes(userRole || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  if (!fileName || !fileType) {
    return NextResponse.json(
      { error: "Missing fileName or fileType" },
      { status: 400 }
    );
  }

  // Validate content type
  const videoTypes = ["video/mp4", "video/quicktime", "video/webm", "video/x-msvideo"];
  const imageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const allowedTypes = [...videoTypes, ...imageTypes];

  if (!allowedTypes.includes(fileType)) {
    return NextResponse.json(
      { error: "Invalid content type. Allowed: MP4, MOV, WebM, AVI, JPEG, PNG, WebP, GIF" },
      { status: 400 }
    );
  }

  // Generate unique key for the file
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 15);
  const sanitizedFilename = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");

  // Use different folders based on content type and optional folder parameter
  let folder: string;

  if (folderParam === "training-videos") {
    folder = "training-videos";
  } else if (folderParam === "broadcast-videos") {
    folder = "broadcast-videos";
  } else if (folderParam === "broadcast-images") {
    folder = "broadcast-images";
  } else if (videoTypes.includes(fileType)) {
    folder = "video-reels";
  } else {
    folder = "headshots";
  }

  const key = `${folder}/${timestamp}-${randomId}-${sanitizedFilename}`;

  try {
    const putCommand = new PutObjectCommand({
      Bucket: S3_BUCKETS.VIDEOS,
      Key: key,
      ContentType: fileType,
    });

    // Generate pre-signed URL valid for 15 minutes for upload
    const uploadUrl = await getSignedUrl(s3Client, putCommand, { expiresIn: 900 });

    // Construct the permanent URL for the file (for storage in DB)
    const fileUrl = `https://${S3_BUCKETS.VIDEOS}.s3.us-west-2.amazonaws.com/${key}`;

    // Generate pre-signed URL for immediate viewing (valid for 1 hour)
    const getCommand = new GetObjectCommand({
      Bucket: S3_BUCKETS.VIDEOS,
      Key: key,
    });
    const viewUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 });

    return NextResponse.json({
      uploadUrl,
      fileUrl,
      viewUrl, // Presigned URL for immediate preview
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
