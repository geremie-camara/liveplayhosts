// Location types for tagging users

export interface Location {
  id: string;
  name: string;
  country: string;
  createdAt: string;
  updatedAt: string;
}

export interface LocationFormData {
  name: string;
  country: string;
}

// Common countries for dropdown
export const COUNTRIES = [
  "United States",
  "United Kingdom",
  "Poland",
  "Canada",
  "Australia",
  "Germany",
  "France",
  "Spain",
  "Italy",
  "Japan",
  "Philippines",
  "Indonesia",
  "Thailand",
  "Vietnam",
  "Singapore",
  "Malaysia",
  "Brazil",
  "Mexico",
  "India",
  "China",
  "South Korea",
  "Taiwan",
  "Hong Kong",
  "Netherlands",
  "Sweden",
  "Norway",
  "Denmark",
  "Finland",
  "Ireland",
  "Portugal",
  "Switzerland",
  "Austria",
  "Belgium",
] as const;

export type Country = (typeof COUNTRIES)[number];
