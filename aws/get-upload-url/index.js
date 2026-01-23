const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const crypto = require("crypto");

const s3Client = new S3Client({});

const BUCKET_NAME = process.env.BUCKET_NAME || "liveplayhosts-uploads";
const URL_EXPIRATION = 300; // 5 minutes
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "https://www.liveplayhosts.com";

// CORS headers - restrict to production domain
const headers = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Credentials": "true",
  "Content-Type": "application/json",
};

// Allowed video MIME types
const ALLOWED_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-msvideo",
];

exports.handler = async (event) => {
  // Handle preflight requests
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: "",
    };
  }

  try {
    const queryParams = event.queryStringParameters || {};
    const { filename, contentType } = queryParams;

    // Validate parameters
    if (!filename || !contentType) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Missing required parameters: filename and contentType",
        }),
      };
    }

    // Validate content type
    if (!ALLOWED_TYPES.includes(contentType)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Invalid file type. Allowed types: MP4, MOV, WebM, AVI",
        }),
      };
    }

    // Generate unique file key
    const fileExtension = filename.split(".").pop();
    const uniqueId = crypto.randomUUID();
    const timestamp = Date.now();
    const key = `video-reels/${timestamp}-${uniqueId}.${fileExtension}`;

    // Generate pre-signed URL
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: URL_EXPIRATION,
    });

    // Construct the file URL (after upload)
    const fileUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`;

    console.log(`Generated upload URL for: ${key}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        uploadUrl,
        fileUrl,
        key,
        expiresIn: URL_EXPIRATION,
      }),
    };
  } catch (error) {
    console.error("Error generating upload URL:", error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Failed to generate upload URL. Please try again.",
      }),
    };
  }
};
