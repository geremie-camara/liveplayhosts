const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const crypto = require("crypto");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || "liveplayhosts-applications";

// CORS headers
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

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
    const body = JSON.parse(event.body);

    // Validate required fields
    const requiredFields = [
      "firstName",
      "lastName",
      "email",
      "phone",
      "street",
      "city",
      "state",
      "zip",
      "experience",
    ];

    for (const field of requiredFields) {
      if (!body[field]) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: `Missing required field: ${field}` }),
        };
      }
    }

    // Validate email format
    const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
    if (!emailRegex.test(body.email)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Invalid email address" }),
      };
    }

    // Generate unique ID
    const applicationId = crypto.randomUUID();

    // Prepare item for DynamoDB
    const item = {
      id: applicationId,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email.toLowerCase(),
      phone: body.phone,
      address: {
        street: body.street,
        city: body.city,
        state: body.state,
        zip: body.zip,
      },
      socialProfiles: {
        instagram: body.instagram || null,
        tiktok: body.tiktok || null,
        youtube: body.youtube || null,
        linkedin: body.linkedin || null,
        other: body.otherSocial || null,
      },
      experience: body.experience,
      videoReelUrl: body.videoReelUrl || null,
      status: "pending",
      submittedAt: body.submittedAt || new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    // Save to DynamoDB
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
      })
    );

    console.log(`Application saved: ${applicationId}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        applicationId,
        message: "Application submitted successfully",
      }),
    };
  } catch (error) {
    console.error("Error processing application:", error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Failed to submit application. Please try again.",
      }),
    };
  }
};
