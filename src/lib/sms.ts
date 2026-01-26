import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

// Initialize SNS client using the same AWS credentials as S3
// Note: SMS uses us-east-1 region (us-west-2 requires registered origination number)
const getSnsClient = () => {
  return new SNSClient({
    region: "us-east-1",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
    },
  });
};

interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Format phone number to E.164 format
export function formatPhoneE164(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, "");

  // If it starts with 1 and has 11 digits, it's already US format
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  // If it has 10 digits, assume US and add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // Otherwise, just add + prefix if not present
  return digits.startsWith("+") ? digits : `+${digits}`;
}

// Validate phone number format
export function isValidPhoneNumber(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  // US numbers should have 10 or 11 digits
  return digits.length >= 10 && digits.length <= 15;
}

// Truncate message to SMS limit (160 chars for single SMS)
export function truncateForSms(message: string, maxLength: number = 160): string {
  if (message.length <= maxLength) {
    return message;
  }
  return message.substring(0, maxLength - 3) + "...";
}

// Build SMS message with link
export function buildSmsMessage(
  subject: string,
  bodySms: string,
  messageUrl: string
): string {
  // Template: "New message from LivePlay: {subject}. {bodySms} Read more: {url}"
  const prefix = `New message: ${subject}. `;
  const suffix = ` Read: ${messageUrl}`;

  // Calculate available space for body
  const availableForBody = 160 - prefix.length - suffix.length;

  let body = bodySms;
  if (body.length > availableForBody) {
    body = body.substring(0, availableForBody - 3) + "...";
  }

  return `${prefix}${body}${suffix}`;
}

// Send SMS via AWS SNS
export async function sendSms(
  phoneNumber: string,
  message: string
): Promise<SMSResult> {
  try {
    // Validate phone number
    if (!isValidPhoneNumber(phoneNumber)) {
      return {
        success: false,
        error: `Invalid phone number format: ${phoneNumber}`,
      };
    }

    const formattedPhone = formatPhoneE164(phoneNumber);
    const client = getSnsClient();

    const command = new PublishCommand({
      PhoneNumber: formattedPhone,
      Message: truncateForSms(message),
      MessageAttributes: {
        "AWS.SNS.SMS.SMSType": {
          DataType: "String",
          StringValue: "Transactional", // Higher delivery priority
        },
        "AWS.SNS.SMS.SenderID": {
          DataType: "String",
          StringValue: "LivePlay", // Sender ID (may not be supported in all regions)
        },
      },
    });

    const result = await client.send(command);

    return {
      success: true,
      messageId: result.MessageId,
    };
  } catch (error) {
    console.error("Failed to send SMS:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Send broadcast SMS with link to message center
export async function sendBroadcastSms(
  phoneNumber: string,
  subject: string,
  bodySms: string,
  broadcastId: string
): Promise<SMSResult> {
  // Build URL to message in message center
  const messageUrl = `https://www.liveplayhosts.com/messages/${broadcastId}`;

  // Build the full SMS message
  const message = buildSmsMessage(subject, bodySms, messageUrl);

  return sendSms(phoneNumber, message);
}

// Check if SNS is configured (uses same credentials as S3)
export function isSmsConfigured(): boolean {
  return !!(process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);
}
