import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-west-2",
});

export const dynamoDb = DynamoDBDocumentClient.from(client);

export const TABLES = {
  HOSTS: "liveplayhosts-hosts",
};
