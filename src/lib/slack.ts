import { WebClient } from "@slack/web-api";

// Initialize Slack client
const getSlackClient = () => {
  if (!process.env.SLACK_BOT_TOKEN) {
    throw new Error("SLACK_BOT_TOKEN environment variable is not set");
  }
  return new WebClient(process.env.SLACK_BOT_TOKEN);
};

// Convert HTML to Slack mrkdwn format
export function htmlToMrkdwn(html: string): string {
  let text = html;

  // Convert headings
  text = text.replace(/<h1[^>]*>(.*?)<\/h1>/gi, "*$1*\n\n");
  text = text.replace(/<h2[^>]*>(.*?)<\/h2>/gi, "*$1*\n\n");
  text = text.replace(/<h3[^>]*>(.*?)<\/h3>/gi, "*$1*\n");

  // Convert bold and italic
  text = text.replace(/<strong[^>]*>(.*?)<\/strong>/gi, "*$1*");
  text = text.replace(/<b[^>]*>(.*?)<\/b>/gi, "*$1*");
  text = text.replace(/<em[^>]*>(.*?)<\/em>/gi, "_$1_");
  text = text.replace(/<i[^>]*>(.*?)<\/i>/gi, "_$1_");

  // Convert links
  text = text.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "<$1|$2>");

  // Convert lists
  text = text.replace(/<ul[^>]*>/gi, "");
  text = text.replace(/<\/ul>/gi, "\n");
  text = text.replace(/<ol[^>]*>/gi, "");
  text = text.replace(/<\/ol>/gi, "\n");
  text = text.replace(/<li[^>]*>(.*?)<\/li>/gi, "• $1\n");

  // Convert paragraphs and line breaks
  text = text.replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<div[^>]*>(.*?)<\/div>/gi, "$1\n");

  // Convert code
  text = text.replace(/<code[^>]*>(.*?)<\/code>/gi, "`$1`");
  text = text.replace(/<pre[^>]*>(.*?)<\/pre>/gi, "```$1```");

  // Convert blockquotes
  text = text.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, "> $1\n");

  // Remove remaining HTML tags
  text = text.replace(/<[^>]+>/g, "");

  // Decode HTML entities
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");

  // Clean up extra whitespace
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.trim();

  return text;
}

interface SlackDMResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Send a direct message to a Slack user
export async function sendSlackDM(
  slackId: string,
  subject: string,
  bodyHtml: string,
  videoUrl?: string,
  linkUrl?: string,
  linkText?: string
): Promise<SlackDMResult> {
  try {
    const client = getSlackClient();

    // Convert HTML to mrkdwn
    const mrkdwnBody = htmlToMrkdwn(bodyHtml) || "No content";

    // Truncate subject for header block (max 150 chars)
    const truncatedSubject = subject ? subject.substring(0, 150) : "Message";

    // Build blocks for rich formatting
    const blocks: Array<{
      type: string;
      text?: { type: string; text: string };
      accessory?: { type: string; text?: { type: string; text: string }; url?: string };
      elements?: Array<{ type: string; text: { type: string; text: string }; url: string }>;
    }> = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: truncatedSubject,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: mrkdwnBody,
        },
      },
    ];

    // Add video link if provided (Slack will unfurl it with preview)
    if (videoUrl) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `📹 *Video:* ${videoUrl}`,
        },
      });
    }

    // Add CTA button if provided
    if (linkUrl) {
      blocks.push({
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: linkText || "Learn More",
            },
            url: linkUrl,
          },
        ],
      });
    }

    // Send message
    const result = await client.chat.postMessage({
      channel: slackId,
      text: `${subject}\n\n${mrkdwnBody}`, // Fallback text
      blocks,
      unfurl_links: true,
      unfurl_media: true,
    });

    return {
      success: true,
      messageId: result.ts,
    };
  } catch (error) {
    console.error("Failed to send Slack DM:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Check if Slack is configured
export function isSlackConfigured(): boolean {
  return !!process.env.SLACK_BOT_TOKEN;
}

// Look up a user by email
export async function findSlackUserByEmail(email: string): Promise<string | null> {
  try {
    const client = getSlackClient();
    const result = await client.users.lookupByEmail({ email });
    return result.user?.id || null;
  } catch (error) {
    console.error("Failed to look up Slack user:", error);
    return null;
  }
}
