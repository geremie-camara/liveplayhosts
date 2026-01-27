import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: process.env.S3_REGION || "us-west-2",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  },
});

export const dynamoDb = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

export const TABLES = {
  HOSTS: "liveplayhosts-hosts",
  AVAILABILITY: "liveplayhosts-availability",
  // Training/LMS tables
  COURSES: "liveplayhosts-courses",
  SECTIONS: "liveplayhosts-sections",
  LESSONS: "liveplayhosts-lessons",
  QUIZZES: "liveplayhosts-quizzes",
  FAQS: "liveplayhosts-faqs",
  TRAINING_PROGRESS: "liveplayhosts-training-progress",
  QUIZ_ATTEMPTS: "liveplayhosts-quiz-attempts",
  // Broadcast messaging tables
  BROADCASTS: "liveplayhosts-broadcasts",
  BROADCAST_TEMPLATES: "liveplayhosts-broadcast-templates",
  BROADCAST_DELIVERIES: "liveplayhosts-broadcast-deliveries",
  // Location management
  LOCATIONS: "liveplayhosts-locations",
  // Call out requests
  CALLOUTS: "liveplayhosts-callouts",
  // Availability change log
  AVAILABILITY_CHANGELOG: "liveplayhosts-availability-changelog",
};
