import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const s3Client = new S3Client({
  region: process.env.S3_REGION || "us-west-2",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  },
});

export const S3_BUCKETS = {
  VIDEOS: "liveplayhosts-videos-224776848446",
};

// Generate a presigned URL for viewing/downloading a video
// Default expiration is 7 days (604800 seconds)
export async function getPresignedVideoUrl(
  videoUrl: string,
  expiresIn: number = 604800
): Promise<string> {
  // Extract bucket and key from S3 URL
  // URL formats:
  // - https://bucket-name.s3.region.amazonaws.com/key
  // - https://bucket-name.s3.amazonaws.com/key
  // - s3://bucket-name/key

  let bucket: string;
  let key: string;

  try {
    if (videoUrl.startsWith('s3://')) {
      const parts = videoUrl.replace('s3://', '').split('/');
      bucket = parts[0];
      key = parts.slice(1).join('/');
    } else {
      const url = new URL(videoUrl);
      const hostParts = url.hostname.split('.');
      bucket = hostParts[0];
      key = url.pathname.slice(1); // Remove leading slash
    }

    if (!bucket || !key) {
      console.error('Could not parse S3 URL:', videoUrl);
      return videoUrl; // Return original URL as fallback
    }

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn });
    return presignedUrl;
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return videoUrl; // Return original URL as fallback
  }
}
