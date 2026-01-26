import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ScanCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDb, TABLES } from "@/lib/dynamodb";
import { Host } from "@/lib/types";
import { Resend } from "resend";

// GET /api/hosts - List all hosts
export async function GET(request: NextRequest) {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is admin or owner
  const userRole = (sessionClaims?.metadata as { role?: string })?.role;
  if (userRole !== "admin" && userRole !== "owner" && userRole !== "talent") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get query params
  const { searchParams } = new URL(request.url);
  const roleFilter = searchParams.get("role");
  const rolesFilter = searchParams.get("roles"); // comma-separated list of roles to include
  const excludeRolesFilter = searchParams.get("excludeRoles"); // comma-separated list of roles to exclude
  const search = searchParams.get("search");

  try {
    // Scan DynamoDB table
    const result = await dynamoDb.send(
      new ScanCommand({
        TableName: TABLES.HOSTS,
      })
    );

    let hosts = (result.Items || []) as Host[];

    // Apply filters
    if (roleFilter) {
      hosts = hosts.filter((h) => h.role === roleFilter);
    } else if (rolesFilter) {
      const roles = rolesFilter.split(",");
      hosts = hosts.filter((h) => roles.includes(h.role));
    }

    // Exclude specific roles
    if (excludeRolesFilter) {
      const excludeRoles = excludeRolesFilter.split(",");
      hosts = hosts.filter((h) => !excludeRoles.includes(h.role));
    }

    if (search) {
      const searchLower = search.toLowerCase();
      hosts = hosts.filter(
        (h) =>
          h.firstName.toLowerCase().includes(searchLower) ||
          h.lastName.toLowerCase().includes(searchLower) ||
          h.email.toLowerCase().includes(searchLower)
      );
    }

    // Sort by appliedAt descending
    hosts.sort(
      (a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime()
    );

    return NextResponse.json(hosts);
  } catch (error) {
    console.error("Error fetching hosts:", error);
    return NextResponse.json({ error: "Failed to fetch hosts" }, { status: 500 });
  }
}

// POST /api/hosts - Create new host (for manual entry or applications)
export async function POST(request: NextRequest) {
  const body = await request.json();

  // Check if this is a public application (no auth required) or admin action
  const { userId, sessionClaims } = await auth();
  const userRole = (sessionClaims?.metadata as { role?: string })?.role;
  const isAdmin = userRole === "admin" || userRole === "owner" || userRole === "talent";

  // For non-application requests, require admin
  if (body.source !== "application" && !isAdmin) {
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date().toISOString();

  const newHost: Host = {
    id: crypto.randomUUID(),
    role: body.role || "applicant",
    firstName: body.firstName,
    lastName: body.lastName,
    email: body.email.toLowerCase(),
    phone: body.phone,
    location: body.location || undefined,
    address: {
      street: body.street || "",
      city: body.city || "",
      state: body.state || "",
      zip: body.zip || "",
    },
    slackId: body.slackId || undefined,
    slackChannelId: body.slackChannelId || undefined,
    socialProfiles: {
      instagram: body.instagram || undefined,
      tiktok: body.tiktok || undefined,
      youtube: body.youtube || undefined,
      linkedin: body.linkedin || undefined,
      other: body.otherSocial || undefined,
    },
    experience: body.experience || "",
    videoReelUrl: body.videoReelUrl || undefined,
    headshotUrl: body.headshotUrl || undefined,
    appliedAt: now,
    createdAt: now,
    updatedAt: now,
    notes: body.notes || undefined,
  };

  try {
    await dynamoDb.send(
      new PutCommand({
        TableName: TABLES.HOSTS,
        Item: newHost,
      })
    );

    // Send email notification for new applications
    if (body.source === "application" && process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      // Default to a fallback email if NOTIFICATION_EMAILS is not set
      const notificationEmails = (process.env.NOTIFICATION_EMAILS || "geremie@liveplayservices.com").split(",").filter(Boolean);

      console.log(`Sending application notification email to: ${notificationEmails.join(", ")}`);

      try {
        const result = await resend.emails.send({
          from: "LivePlay <noreply@liveplayhosts.com>",
          to: notificationEmails,
          subject: `New Host Application: ${newHost.firstName} ${newHost.lastName}`,
          html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="text-align: center; margin-bottom: 30px;">
      <img src="https://www.liveplayhosts.com/logo.png" alt="LivePlay" style="height: 40px; width: auto;" />
    </div>
    <div style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
      <h1 style="margin: 0 0 24px 0; font-size: 24px; font-weight: 600; color: #1a1a2e;">
        New Host Application
      </h1>
      <div style="background: #fef3c7; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <p style="margin: 0; color: #92400e; font-weight: 500;">Action Required: Review this application</p>
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #6b7280; width: 120px;">Name</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #1a1a2e; font-weight: 500;">${newHost.firstName} ${newHost.lastName}</td>
        </tr>
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #6b7280;">Email</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #eee;"><a href="mailto:${newHost.email}" style="color: #667eea;">${newHost.email}</a></td>
        </tr>
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #6b7280;">Phone</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #eee;"><a href="tel:${newHost.phone}" style="color: #667eea;">${newHost.phone}</a></td>
        </tr>
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #6b7280;">Location</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #1a1a2e;">${newHost.address.city}, ${newHost.address.state} ${newHost.address.zip}</td>
        </tr>
        ${newHost.socialProfiles?.instagram ? `
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #6b7280;">Instagram</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #eee;"><a href="https://instagram.com/${newHost.socialProfiles.instagram.replace('@', '')}" style="color: #667eea;" target="_blank">${newHost.socialProfiles.instagram}</a></td>
        </tr>
        ` : ""}
        ${newHost.socialProfiles?.tiktok ? `
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #6b7280;">TikTok</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #eee;"><a href="https://tiktok.com/${newHost.socialProfiles.tiktok.replace('@', '')}" style="color: #667eea;" target="_blank">${newHost.socialProfiles.tiktok}</a></td>
        </tr>
        ` : ""}
      </table>
      <div style="margin-top: 24px;">
        <p style="color: #6b7280; margin: 0 0 8px 0; font-weight: 500;">Experience:</p>
        <p style="color: #1a1a2e; margin: 0; white-space: pre-wrap;">${newHost.experience}</p>
      </div>
      ${newHost.headshotUrl || newHost.videoReelUrl ? `
      <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #eee;">
        <p style="color: #6b7280; margin: 0 0 12px 0; font-weight: 500;">Attachments:</p>
        ${newHost.headshotUrl ? `<p style="margin: 0 0 8px 0;"><a href="${newHost.headshotUrl}" style="color: #667eea;" target="_blank">View Headshot Photo</a></p>` : ""}
        ${newHost.videoReelUrl ? `<p style="margin: 0;"><a href="${newHost.videoReelUrl}" style="color: #667eea;" target="_blank">View Video Reel</a></p>` : ""}
      </div>
      ` : ""}
      <div style="margin-top: 30px; text-align: center;">
        <a href="https://www.liveplayhosts.com/admin/users?tab=applicants" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Review Application
        </a>
      </div>
    </div>
    <div style="text-align: center; margin-top: 30px; font-size: 14px; color: #8a8a9a;">
      <p style="margin: 0;">This notification was sent from LivePlay Hosts</p>
    </div>
  </div>
</body>
</html>
          `,
        });
        console.log(`Application notification email sent successfully:`, result);

        // Also send confirmation email to the applicant
        try {
          await resend.emails.send({
            from: "LivePlay <noreply@liveplayhosts.com>",
            to: [newHost.email],
            subject: "We received your application!",
            html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="text-align: center; margin-bottom: 30px;">
      <img src="https://www.liveplayhosts.com/logo.png" alt="LivePlay" style="height: 40px; width: auto;" />
    </div>
    <div style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
      <h1 style="margin: 0 0 24px 0; font-size: 24px; font-weight: 600; color: #1a1a2e;">
        Thanks for applying, ${newHost.firstName}!
      </h1>
      <p style="font-size: 16px; line-height: 1.6; color: #4a4a5a; margin: 0 0 16px 0;">
        We've received your application to become a LivePlay Host. Our team will review your submission and get back to you soon.
      </p>
      <p style="font-size: 16px; line-height: 1.6; color: #4a4a5a; margin: 0 0 24px 0;">
        In the meantime, make sure to follow us on social media to see what our hosts are up to!
      </p>
      <div style="background: #f0fdf4; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <p style="margin: 0; color: #166534; font-weight: 500;">What happens next?</p>
        <ul style="margin: 12px 0 0 0; padding-left: 20px; color: #166534;">
          <li style="margin-bottom: 8px;">Our team reviews your application</li>
          <li style="margin-bottom: 8px;">If selected, we'll reach out to schedule an interview</li>
          <li>You'll complete our training program and start hosting!</li>
        </ul>
      </div>
      <p style="font-size: 16px; line-height: 1.6; color: #4a4a5a; margin: 0;">
        Questions? Reply to this email and we'll get back to you.
      </p>
    </div>
    <div style="text-align: center; margin-top: 30px; font-size: 14px; color: #8a8a9a;">
      <p style="margin: 0 0 10px 0;">LivePlay Hosts</p>
      <p style="margin: 0;">
        <a href="https://www.liveplayhosts.com" style="color: #667eea; text-decoration: none;">www.liveplayhosts.com</a>
      </p>
    </div>
  </div>
</body>
</html>
            `,
          });
          console.log(`Confirmation email sent to applicant: ${newHost.email}`);
        } catch (applicantEmailError) {
          console.error("Failed to send applicant confirmation email:", applicantEmailError);
        }
      } catch (emailError) {
        console.error("Failed to send notification email:", emailError);
        // Don't fail the request if email fails
      }
    }

    return NextResponse.json(newHost, { status: 201 });
  } catch (error) {
    console.error("Error creating host:", error);
    return NextResponse.json({ error: "Failed to create host" }, { status: 500 });
  }
}
