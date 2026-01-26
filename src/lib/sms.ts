import Twilio from "twilio";

// Initialize Twilio client
const getTwilioClient = () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    return null;
  }

  return Twilio(accountSid, authToken);
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
  bodySms: string,
  messageUrl: string
): string {
  // Append the URL to the message
  const suffix = ` ${messageUrl}`;

  // Calculate available space for body
  const availableForBody = 160 - suffix.length;

  let body = bodySms;
  if (body.length > availableForBody) {
    body = body.substring(0, availableForBody - 3) + "...";
  }

  return `${body}${suffix}`;
}

// Send SMS via Twilio
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

    const client = getTwilioClient();
    if (!client) {
      return {
        success: false,
        error: "Twilio not configured (missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN)",
      };
    }

    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
    if (!twilioPhoneNumber) {
      return {
        success: false,
        error: "Twilio phone number not configured (missing TWILIO_PHONE_NUMBER)",
      };
    }

    const formattedPhone = formatPhoneE164(phoneNumber);

    const result = await client.messages.create({
      body: truncateForSms(message),
      from: twilioPhoneNumber,
      to: formattedPhone,
    });

    return {
      success: true,
      messageId: result.sid,
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

  // Build the full SMS message (bodySms already includes the subject from auto-populate)
  const message = buildSmsMessage(bodySms, messageUrl);

  return sendSms(phoneNumber, message);
}

// Check if Twilio is configured
export function isSmsConfigured(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  );
}
