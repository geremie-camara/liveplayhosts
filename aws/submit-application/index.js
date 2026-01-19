const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const crypto = require("crypto");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || "liveplayhosts-hosts";

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
    const hostId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Prepare host record for DynamoDB
    // New applicants start with status "applicant" and role "trainee"
    const host = {
      id: hostId,

      // Status & Role - new applications are applicants
      status: "applicant",
      role: "trainee",

      // Personal Information
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email.toLowerCase(),
      phone: body.phone,

      // Address
      address: {
        street: body.street,
        city: body.city,
        state: body.state,
        zip: body.zip,
      },

      // Social Profiles
      socialProfiles: {
        instagram: body.instagram || null,
        tiktok: body.tiktok || null,
        youtube: body.youtube || null,
        linkedin: body.linkedin || null,
        other: body.otherSocial || null,
      },

      // Application Info
      experience: body.experience,
      videoReelUrl: body.videoReelUrl || null,

      // Clerk Integration (will be set when they create an account)
      clerkUserId: null,

      // Timestamps
      appliedAt: now,
      invitedAt: null,
      hiredAt: null,
      createdAt: now,
      updatedAt: now,

      // Notes
      notes: null,
    };

    // Save to DynamoDB
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: host,
      })
    );

    console.log(`Application saved: ${hostId} - ${body.email}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        hostId,
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
