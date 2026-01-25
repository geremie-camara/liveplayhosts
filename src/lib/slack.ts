import { WebClient } from "@slack/web-api";

// Initialize Slack client
const getSlackClient = () => {
  if (!process.env.SLACK_BOT_TOKEN) {
    throw new Error("SLACK_BOT_TOKEN environment variable is not set");
  }
  return new WebClient(process.env.SLACK_BOT_TOKEN);
};

// Extract image URLs from HTML
export function extractImagesFromHtml(html: string): string[] {
  const imgRegex = /<img[^>]+src="([^"]+)"/gi;
  const images: string[] = [];
  let match;

  while ((match = imgRegex.exec(html)) !== null) {
    images.push(match[1]);
  }

  return images;
}

// Convert HTML to Slack mrkdwn format
export function htmlToMrkdwn(html: string): string {
  let text = html;

  // Remove img tags (they'll be handled separately as image blocks)
  text = text.replace(/<img[^>]*>/gi, "");

  // Convert headings - use visual differentiation since Slack doesn't have font sizes
  // H1: Bold with separator lines
  text = text.replace(/<h1[^>]*>(.*?)<\/h1>/gi, "*━━ $1 ━━*\n\n");
  // H2: Bold with arrow prefix
  text = text.replace(/<h2[^>]*>(.*?)<\/h2>/gi, "*▸ $1*\n\n");
  // H3: Bold italic
  text = text.replace(/<h3[^>]*>(.*?)<\/h3>/gi, "*_$1_*\n");

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
  linkText?: string,
  senderName?: string
): Promise<SlackDMResult> {
  try {
    const client = getSlackClient();

    // Extract images from HTML before converting to mrkdwn
    const images = extractImagesFromHtml(bodyHtml);

    // Convert HTML to mrkdwn
    const mrkdwnBody = htmlToMrkdwn(bodyHtml) || "No content";

    // Truncate subject for header block (max 150 chars)
    const truncatedSubject = subject ? subject.substring(0, 150) : "Message";

    // Build blocks for rich formatting
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blocks: any[] = [
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

    // Add image blocks for each inline image
    for (let i = 0; i < images.length; i++) {
      let imageUrl = images[i];
      // Ensure URL has protocol
      if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
        imageUrl = `https://${imageUrl}`;
      }
      blocks.push({
        type: "image",
        image_url: imageUrl,
        alt_text: `Image ${i + 1}`,
      });
    }

    // Add video section if provided
    if (videoUrl) {
      // Ensure video URL has protocol
      let validVideoUrl = videoUrl;
      if (!videoUrl.startsWith('http://') && !videoUrl.startsWith('https://')) {
        validVideoUrl = `https://${videoUrl}`;
      }
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `:movie_camera: *Video attached*`,
        },
        accessory: {
          type: "button",
          text: {
            type: "plain_text",
            text: "▶️ Watch Video",
            emoji: true,
          },
          url: validVideoUrl,
          action_id: "watch_video",
        },
      });
    }

    // Add CTA button if provided
    if (linkUrl) {
      // Ensure URL has protocol
      let validUrl = linkUrl;
      if (!linkUrl.startsWith('http://') && !linkUrl.startsWith('https://')) {
        validUrl = `https://${linkUrl}`;
      }
      blocks.push({
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: linkText || "Learn More",
            },
            url: validUrl,
          },
        ],
      });
    }

    // Add "Sent by" footer if sender name provided
    if (senderName) {
      blocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `_Sent by ${senderName}_`,
          },
        ],
      });
    }

    // Send message
    const result = await client.chat.postMessage({
      channel: slackId,
      text: `${subject}\n\n${mrkdwnBody}${senderName ? `\n\nSent by ${senderName}` : ""}`, // Fallback text
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
