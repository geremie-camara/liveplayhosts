import { Resend } from "resend";

// Initialize Resend client
const getResendClient = () => {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY environment variable is not set");
  }
  return new Resend(process.env.RESEND_API_KEY);
};

// Default from address
const DEFAULT_FROM = "LivePlay <noreply@liveplayhosts.com>";

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Generate email HTML template
function generateEmailHtml(
  subject: string,
  bodyHtml: string,
  videoUrl?: string,
  linkUrl?: string,
  linkText?: string,
  senderName?: string
): string {
  // Video thumbnail section
  const videoSection = videoUrl
    ? `
      <div style="margin: 20px 0; text-align: center;">
        <a href="${videoUrl}" target="_blank" style="display: inline-block; position: relative;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 60px; border-radius: 12px; color: white;">
            <div style="font-size: 48px; margin-bottom: 10px;">▶</div>
            <div style="font-size: 14px;">Click to watch video</div>
          </div>
        </a>
      </div>
    `
    : "";

  // CTA button section
  const ctaSection = linkUrl
    ? `
      <div style="margin: 30px 0; text-align: center;">
        <a href="${linkUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
          ${linkText || "Learn More"}
        </a>
      </div>
    `
    : "";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 30px;">
      <img src="https://www.liveplayhosts.com/images/logo.png" alt="LivePlay" style="height: 40px; width: auto;" />
    </div>

    <!-- Main Content Card -->
    <div style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
      <!-- Subject -->
      <h1 style="margin: 0 0 24px 0; font-size: 24px; font-weight: 600; color: #1a1a2e; line-height: 1.3;">
        ${subject}
      </h1>

      <!-- Body -->
      <div style="font-size: 16px; line-height: 1.6; color: #4a4a5a;">
        ${bodyHtml}
      </div>

      ${videoSection}
      ${ctaSection}
    </div>

    <!-- Footer -->
    <div style="text-align: center; margin-top: 30px; font-size: 14px; color: #8a8a9a;">
      ${senderName ? `<p style="margin: 0 0 10px 0; font-style: italic;">Sent by ${senderName}</p>` : ""}
      <p style="margin: 0 0 10px 0;">
        This message was sent from LivePlay Hosts
      </p>
      <p style="margin: 0;">
        <a href="https://www.liveplayhosts.com/messages" style="color: #667eea; text-decoration: none;">
          View all messages in your Message Center
        </a>
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

// Send a broadcast email
export async function sendBroadcastEmail(
  to: string,
  subject: string,
  bodyHtml: string,
  videoUrl?: string,
  linkUrl?: string,
  linkText?: string,
  senderName?: string
): Promise<EmailResult> {
  try {
    const resend = getResendClient();

    const html = generateEmailHtml(subject, bodyHtml, videoUrl, linkUrl, linkText, senderName);

    const result = await resend.emails.send({
      from: DEFAULT_FROM,
      to: [to],
      subject: subject,
      html: html,
    });

    if (result.error) {
      return {
        success: false,
        error: result.error.message,
      };
    }

    return {
      success: true,
      messageId: result.data?.id,
    };
  } catch (error) {
    console.error("Failed to send broadcast email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Send notification email (for admin alerts)
export async function sendNotificationEmail(
  to: string[],
  subject: string,
  bodyHtml: string
): Promise<EmailResult> {
  try {
    const resend = getResendClient();

    const result = await resend.emails.send({
      from: "LivePlay Hosts <onboarding@resend.dev>",
      to: to,
      subject: subject,
      html: bodyHtml,
    });

    if (result.error) {
      return {
        success: false,
        error: result.error.message,
      };
    }

    return {
      success: true,
      messageId: result.data?.id,
    };
  } catch (error) {
    console.error("Failed to send notification email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Check if email is configured
export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}
