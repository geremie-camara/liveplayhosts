import { cookies } from "next/headers";
import { auth, currentUser } from "@clerk/nextjs/server";
import { GetCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDb, TABLES } from "@/lib/dynamodb";
import { Host } from "@/lib/types";
import { isAdmin, Role } from "@/lib/roles";

// Cookie name for ghost (impersonation) mode
export const GHOST_COOKIE_NAME = "lph_ghost_host_id";

// Max age: 4 hours in seconds
export const GHOST_COOKIE_MAX_AGE = 4 * 60 * 60;

// --- Core host lookup functions ---

/** Look up a host record by Clerk userId (DynamoDB scan) */
export async function getHostByClerkId(clerkUserId: string): Promise<Host | null> {
  try {
    const result = await dynamoDb.send(
      new ScanCommand({
        TableName: TABLES.HOSTS,
        FilterExpression: "clerkUserId = :clerkUserId",
        ExpressionAttributeValues: {
          ":clerkUserId": clerkUserId,
        },
      })
    );
    return (result.Items?.[0] as Host) || null;
  } catch {
    return null;
  }
}

/** Look up a host by clerkUserId with email fallback + auto-fix */
export async function getHostByClerkIdWithEmailFallback(
  clerkUserId: string,
  email: string
): Promise<Host | null> {
  // First try by clerkUserId
  const host = await getHostByClerkId(clerkUserId);
  if (host) return host;

  // Fallback: try by email
  if (!email) return null;

  try {
    const emailResult = await dynamoDb.send(
      new ScanCommand({
        TableName: TABLES.HOSTS,
        FilterExpression: "email = :email",
        ExpressionAttributeValues: {
          ":email": email.toLowerCase(),
        },
      })
    );

    const foundHost = emailResult.Items?.[0] as Host | undefined;

    // Auto-fix: Update the host record with clerkUserId for future lookups
    if (foundHost && !foundHost.clerkUserId) {
      try {
        await dynamoDb.send(
          new UpdateCommand({
            TableName: TABLES.HOSTS,
            Key: { id: foundHost.id },
            UpdateExpression: "SET clerkUserId = :clerkUserId",
            ExpressionAttributeValues: {
              ":clerkUserId": clerkUserId,
            },
          })
        );
        console.log(`Auto-fixed clerkUserId for host ${foundHost.id} (${email})`);
      } catch (err) {
        console.error("Failed to auto-fix clerkUserId:", err);
      }
    }

    return foundHost || null;
  } catch {
    return null;
  }
}

/** Look up a host directly by DynamoDB primary key (host.id) */
export async function getHostById(hostId: string): Promise<Host | null> {
  try {
    const result = await dynamoDb.send(
      new GetCommand({
        TableName: TABLES.HOSTS,
        Key: { id: hostId },
      })
    );
    return (result.Item as Host) || null;
  } catch {
    return null;
  }
}

// --- Ghost (impersonation) functions ---

/** Read the ghost cookie and return the impersonated host.id, or null */
export async function getGhostHostId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const ghostCookie = cookieStore.get(GHOST_COOKIE_NAME);
    return ghostCookie?.value || null;
  } catch {
    return null;
  }
}

export interface EffectiveHostResult {
  host: Host;
  isImpersonating: boolean;
  adminClerkUserId?: string;
}

/**
 * Main entry point for resolving the "effective" host.
 * If the caller is an admin with a ghost cookie set, returns the impersonated host.
 * Otherwise falls back to normal Clerk-based host lookup.
 */
export async function getEffectiveHost(): Promise<EffectiveHostResult | null> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return null;

  // Check for impersonation
  const ghostHostId = await getGhostHostId();
  if (ghostHostId) {
    // Verify the caller is an admin before honoring the cookie
    const user = await currentUser();
    const userRole = user?.publicMetadata?.role as Role | undefined;

    if (user && isAdmin(userRole)) {
      const impersonatedHost = await getHostById(ghostHostId);
      if (impersonatedHost) {
        return {
          host: impersonatedHost,
          isImpersonating: true,
          adminClerkUserId: clerkUserId,
        };
      }
    }
    // If admin check fails or host not found, fall through to normal lookup
  }

  // Normal lookup
  const host = await getHostByClerkId(clerkUserId);
  if (!host) return null;

  return {
    host,
    isImpersonating: false,
  };
}

/**
 * Same as getEffectiveHost but with email fallback for profile/messages routes.
 */
export async function getEffectiveHostWithEmailFallback(): Promise<EffectiveHostResult | null> {
  const user = await currentUser();
  if (!user) return null;

  // Check for impersonation
  const ghostHostId = await getGhostHostId();
  if (ghostHostId) {
    const userRole = user.publicMetadata?.role as Role | undefined;

    if (isAdmin(userRole)) {
      const impersonatedHost = await getHostById(ghostHostId);
      if (impersonatedHost) {
        return {
          host: impersonatedHost,
          isImpersonating: true,
          adminClerkUserId: user.id,
        };
      }
    }
  }

  // Normal lookup with email fallback
  const primaryEmail = user.emailAddresses.find(
    (e) => e.id === user.primaryEmailAddressId
  )?.emailAddress;

  const host = await getHostByClerkIdWithEmailFallback(
    user.id,
    primaryEmail || ""
  );
  if (!host) return null;

  return {
    host,
    isImpersonating: false,
  };
}
