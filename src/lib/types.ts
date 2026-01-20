// Host/Applicant status in the system
export type HostStatus = "applicant" | "invited" | "active" | "inactive";

// Database record for a host/applicant
export interface Host {
  id: string;

  // Status & Role
  status: HostStatus;
  role: "trainee" | "host" | "senior_host" | "admin";

  // Personal Information
  firstName: string;
  lastName: string;
  email: string;
  phone: string;

  // Address
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };

  // Social Profiles
  socialProfiles: {
    instagram?: string;
    tiktok?: string;
    youtube?: string;
    linkedin?: string;
    other?: string;
  };

  // Application Info
  experience: string;
  videoReelUrl?: string;
  headshotUrl?: string;

  // Clerk Integration
  clerkUserId?: string;

  // Timestamps
  appliedAt: string;
  invitedAt?: string;
  hiredAt?: string;
  createdAt: string;
  updatedAt: string;

  // Notes (admin can add notes about the host)
  notes?: string;
}

// Status display configuration
export const HOST_STATUS_CONFIG: Record<HostStatus, { label: string; color: string }> = {
  applicant: { label: "Applicant", color: "bg-yellow-100 text-yellow-800" },
  invited: { label: "Invited", color: "bg-blue-100 text-blue-800" },
  active: { label: "Active", color: "bg-green-100 text-green-800" },
  inactive: { label: "Inactive", color: "bg-gray-100 text-gray-800" },
};

// Form data for creating/updating a host
export interface HostFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  instagram?: string;
  tiktok?: string;
  youtube?: string;
  linkedin?: string;
  otherSocial?: string;
  experience: string;
  videoReelUrl?: string;
  headshotUrl?: string;
  status?: HostStatus;
  role?: Host["role"];
  notes?: string;
}
