const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
  QueryCommand,
} = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || "liveplayhosts-hosts";

// CORS headers
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Content-Type": "application/json",
};

// GET /hosts - List all hosts with optional filters
async function listHosts(queryParams = {}) {
  const { status, role, search } = queryParams;

  let filterExpressions = [];
  let expressionAttributeValues = {};
  let expressionAttributeNames = {};

  if (status) {
    filterExpressions.push("#status = :status");
    expressionAttributeValues[":status"] = status;
    expressionAttributeNames["#status"] = "status";
  }

  if (role) {
    filterExpressions.push("#role = :role");
    expressionAttributeValues[":role"] = role;
    expressionAttributeNames["#role"] = "role";
  }

  const params = {
    TableName: TABLE_NAME,
  };

  if (filterExpressions.length > 0) {
    params.FilterExpression = filterExpressions.join(" AND ");
    params.ExpressionAttributeValues = expressionAttributeValues;
    params.ExpressionAttributeNames = expressionAttributeNames;
  }

  const result = await docClient.send(new ScanCommand(params));

  let hosts = result.Items || [];

  // Client-side search filter (for name/email search)
  if (search) {
    const searchLower = search.toLowerCase();
    hosts = hosts.filter(
      (host) =>
        host.firstName?.toLowerCase().includes(searchLower) ||
        host.lastName?.toLowerCase().includes(searchLower) ||
        host.email?.toLowerCase().includes(searchLower)
    );
  }

  // Sort by appliedAt descending (newest first)
  hosts.sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt));

  return hosts;
}

// GET /hosts/:id - Get single host
async function getHost(id) {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { id },
    })
  );

  return result.Item;
}

// PUT /hosts/:id - Update host
async function updateHost(id, updates) {
  const now = new Date().toISOString();

  // Build update expression
  let updateExpressions = ["#updatedAt = :updatedAt"];
  let expressionAttributeValues = { ":updatedAt": now };
  let expressionAttributeNames = { "#updatedAt": "updatedAt" };

  const allowedFields = [
    "firstName",
    "lastName",
    "email",
    "phone",
    "address",
    "socialProfiles",
    "experience",
    "videoReelUrl",
    "status",
    "role",
    "clerkUserId",
    "invitedAt",
    "hiredAt",
    "notes",
  ];

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      // Handle reserved words
      const attrName = `#${field}`;
      expressionAttributeNames[attrName] = field;
      updateExpressions.push(`${attrName} = :${field}`);
      expressionAttributeValues[`:${field}`] = updates[field];
    }
  }

  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { id },
      UpdateExpression: "SET " + updateExpressions.join(", "),
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: "ALL_NEW",
    })
  );

  return result.Attributes;
}

// DELETE /hosts/:id - Delete host
async function deleteHost(id) {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { id },
    })
  );

  return { success: true };
}

// POST /hosts/:id/invite - Send invite to applicant
async function inviteHost(id) {
  const now = new Date().toISOString();

  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { id },
      UpdateExpression: "SET #status = :status, #invitedAt = :invitedAt, #updatedAt = :updatedAt",
      ExpressionAttributeNames: {
        "#status": "status",
        "#invitedAt": "invitedAt",
        "#updatedAt": "updatedAt",
      },
      ExpressionAttributeValues: {
        ":status": "invited",
        ":invitedAt": now,
        ":updatedAt": now,
      },
      ReturnValues: "ALL_NEW",
    })
  );

  return result.Attributes;
}

exports.handler = async (event) => {
  // Handle preflight requests
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    const method = event.httpMethod;
    const path = event.path;
    const pathParts = path.split("/").filter(Boolean);

    // /hosts
    if (pathParts.length === 1 && pathParts[0] === "hosts") {
      if (method === "GET") {
        const hosts = await listHosts(event.queryStringParameters);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(hosts),
        };
      }
    }

    // /hosts/:id
    if (pathParts.length === 2 && pathParts[0] === "hosts") {
      const id = pathParts[1];

      if (method === "GET") {
        const host = await getHost(id);
        if (!host) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: "Host not found" }),
          };
        }
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(host),
        };
      }

      if (method === "PUT") {
        const updates = JSON.parse(event.body);
        const host = await updateHost(id, updates);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(host),
        };
      }

      if (method === "DELETE") {
        await deleteHost(id);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true }),
        };
      }
    }

    // /hosts/:id/invite
    if (pathParts.length === 3 && pathParts[0] === "hosts" && pathParts[2] === "invite") {
      const id = pathParts[1];

      if (method === "POST") {
        const host = await inviteHost(id);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(host),
        };
      }
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: "Not found" }),
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
