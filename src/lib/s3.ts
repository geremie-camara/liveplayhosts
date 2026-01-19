import { S3Client } from "@aws-sdk/client-s3";

export const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-west-2",
});

export const S3_BUCKETS = {
  VIDEOS: "liveplayhosts-videos-224776848446",
};
