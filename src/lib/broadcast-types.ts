import { UserRole } from "./types";

// Broadcast status
export type BroadcastStatus = "draft" | "scheduled" | "sending" | "sent" | "failed";

// Channel delivery status
export type DeliveryStatus = "pending" | "sent" | "failed" | "skipped";

// Broadcast channels configuration
export interface BroadcastChannels {
  slack: boolean;
  email: boolean;
  sms: boolean;
  hostProducerChannel?: boolean; // Send to host's prod Slack ID
}

// Delivery statistics
export interface BroadcastStats {
  totalRecipients: number;
  slackSent: number;
  slackFailed: number;
  emailSent: number;
  emailFailed: number;
  smsSent: number;
  smsFailed: number;
  readCount: number;
}

// User selection for targeting
export interface UserSelection {
  filterRoles: UserRole[];       // Roles used to filter users
  filterLocations: string[];     // Locations used to filter users
  selectedUserIds: string[];     // Specific user IDs selected
}

// Main broadcast message
export interface Broadcast {
  id: string;                    // broadcast-{timestamp}-{randomId}
  title: string;                 // Admin reference name
  subject: string;               // Email subject / display title
  bodyHtml: string;              // Full HTML for email/slack/message center
  bodySms: string;               // Short text (160 chars) with link
  videoUrl?: string;             // Optional video attachment (S3 URL)
  videoS3Key?: string;           // S3 key for uploaded video
  linkUrl?: string;              // Optional CTA link
  linkText?: string;             // CTA button text
  targetRoles: UserRole[];       // Roles to target (legacy, kept for backwards compat)
  targetLocations?: string[];    // Locations to target
  targetUserIds?: string[];      // Specific user IDs to target
  userSelection?: UserSelection; // Full user selection data
  channels: BroadcastChannels;   // Which channels to send via
  status: BroadcastStatus;
  scheduledAt?: string;          // ISO timestamp for scheduled sends
  sentAt?: string;               // ISO timestamp when sent
  templateId?: string;           // Reference to template used
  createdBy: string;             // Host ID of creator
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
  stats?: BroadcastStats;        // Populated after sending
}

// Template variables for dynamic content
export interface TemplateVariable {
  name: string;                  // e.g., "firstName"
  description: string;           // e.g., "Recipient's first name"
  defaultValue?: string;
}

// Reusable broadcast template
export interface BroadcastTemplate {
  id: string;                    // template-{timestamp}-{randomId}
  name: string;                  // Admin reference name
  subject: string;               // Email subject template
  bodyHtml: string;              // HTML body template
  bodySms: string;               // SMS body template
  videoUrl?: string;             // Optional video attachment (S3 URL)
  linkUrl?: string;              // Optional CTA link
  linkText?: string;             // CTA button text
  defaultChannels: BroadcastChannels;
  defaultUserSelection?: UserSelection; // Saved user selection
  variables: TemplateVariable[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// Channel-specific delivery info
export interface ChannelDelivery {
  status: DeliveryStatus;
  sentAt?: string;               // ISO timestamp
  error?: string;                // Error message if failed
  messageId?: string;            // Provider message ID (resendId, snsMessageId, slackTs)
}

// Per-user delivery tracking
export interface BroadcastDelivery {
  id: string;                    // {broadcastId}#{userId}
  broadcastId: string;
  userId: string;                // Host record ID
  userEmail: string;             // For display purposes
  userName: string;              // For display purposes
  slack: ChannelDelivery;
  email: ChannelDelivery;
  sms: ChannelDelivery;
  readAt?: string;               // When viewed in message center
  createdAt: string;
}

// Rate limit tracking (stored in delivery records or separate)
export interface UserBroadcastCount {
  userId: string;
  date: string;                  // YYYY-MM-DD
  count: number;
}

// Form data for creating/updating a broadcast
export interface BroadcastFormData {
  title: string;
  subject: string;
  bodyHtml: string;
  bodySms: string;
  videoUrl?: string;
  videoS3Key?: string;
  linkUrl?: string;
  linkText?: string;
  targetRoles: UserRole[];
  targetLocations?: string[];
  targetUserIds?: string[];
  userSelection?: UserSelection;
  channels: BroadcastChannels;
  scheduledAt?: string;
  templateId?: string;
}

// Form data for creating/updating a template
export interface TemplateFormData {
  name: string;
  subject: string;
  bodyHtml: string;
  bodySms: string;
  videoUrl?: string;
  linkUrl?: string;
  linkText?: string;
  defaultChannels: BroadcastChannels;
  defaultUserSelection?: UserSelection;
  variables: TemplateVariable[];
}

// API response types
export interface BroadcastWithDeliveries extends Broadcast {
  deliveries?: BroadcastDelivery[];
}

export interface BroadcastListItem extends Broadcast {
  recipientCount?: number;
}

// User message view (for message center)
export interface UserMessage {
  id: string;                    // Same as broadcastId
  broadcastId: string;
  subject: string;
  bodyHtml: string;
  videoUrl?: string;
  linkUrl?: string;
  linkText?: string;
  sentAt: string;
  readAt?: string;
  isRead: boolean;
}

// Status display configuration
export const BROADCAST_STATUS_CONFIG: Record<BroadcastStatus, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-800" },
  scheduled: { label: "Scheduled", color: "bg-yellow-100 text-yellow-800" },
  sending: { label: "Sending", color: "bg-blue-100 text-blue-800" },
  sent: { label: "Sent", color: "bg-green-100 text-green-800" },
  failed: { label: "Failed", color: "bg-red-100 text-red-800" },
};

// Delivery status display configuration
export const DELIVERY_STATUS_CONFIG: Record<DeliveryStatus, { label: string; color: string }> = {
  pending: { label: "Pending", color: "text-gray-400" },
  sent: { label: "Sent", color: "text-green-600" },
  failed: { label: "Failed", color: "text-red-600" },
  skipped: { label: "Skipped", color: "text-yellow-600" },
};

// Rate limit constant
export const BROADCASTS_PER_DAY_LIMIT = 50;
