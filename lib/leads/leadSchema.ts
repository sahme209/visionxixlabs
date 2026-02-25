import { z } from "zod";

export const PROJECT_TYPES = ["new_website", "redesign", "landing_page"] as const;
export const INDUSTRIES = [
  "technology",
  "healthcare",
  "ecommerce",
  "professional_services",
  "education",
  "finance",
  "real_estate",
  "other",
] as const;

export const PROJECT_GOALS = [
  "lead_generation",
  "ecommerce",
  "brand_awareness",
  "portfolio",
  "informational",
  "other",
] as const;

export const TIMELINE_OPTIONS = [
  "asap",
  "1_2_weeks",
  "1_month",
  "2_3_months",
  "flexible",
] as const;

export const BUDGET_RANGES = [
  "under_2k",
  "2k_5k",
  "5k_10k",
  "10k_25k",
  "25k_plus",
  "undecided",
] as const;

export const HOSTING_STATUS = [
  "have_hosting",
  "need_hosting",
  "unsure",
] as const;

export const leadFormSchema = z.object({
  // Step 1: Contact
  fullName: z.string().min(2, "Full name required").max(200),
  businessName: z.string().max(200).optional().default(""),
  email: z.string().email("Valid email required"),
  phone: z.string().max(30).optional().default(""),
  currentWebsiteUrl: z
    .string()
    .max(500)
    .refine((v) => !v || /^https?:\/\/\S+$/.test(v.trim()), "Enter a valid URL or leave blank")
    .optional()
    .default(""),

  // Step 2: Project
  industry: z.enum(INDUSTRIES),
  projectType: z.enum(PROJECT_TYPES),
  numberOfPages: z.coerce.number().int().min(1).max(100),
  requiredSections: z.string().max(1000).optional().default(""),
  projectGoals: z.array(z.enum(PROJECT_GOALS)).min(1, "Select at least one goal"),
  designPreference: z.string().max(500).optional().default(""),
  referenceSites: z.string().max(1000).optional().default(""),

  // Step 3: Add-ons
  copywritingNeeded: z.boolean().default(false),
  logoBrandAssetsReady: z.boolean().default(false),
  hostingDomainStatus: z.enum(HOSTING_STATUS).optional().default("unsure"),
  timeline: z.enum(TIMELINE_OPTIONS).optional().default("flexible"),
  budgetRange: z.enum(BUDGET_RANGES).optional().default("undecided"),
  additionalNotes: z.string().max(3000).optional().default(""),

  // Spam protection (not shown to user)
  _honeypot: z.string().max(0).optional().default(""),
  _startTime: z.number().optional(),
});

export type LeadFormData = z.infer<typeof leadFormSchema>;

/** Partial schema for pricing estimate — accepts incomplete form data with defaults */
export const leadEstimatePayloadSchema = z.object({
  fullName: z.string().optional().default(""),
  businessName: z.string().optional().default(""),
  email: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  currentWebsiteUrl: z.string().optional().default(""),
  industry: z.enum(INDUSTRIES).optional().default("technology"),
  projectType: z.enum(PROJECT_TYPES).optional().default("new_website"),
  numberOfPages: z.coerce.number().int().min(1).max(100).optional().default(5),
  requiredSections: z.string().optional().default(""),
  projectGoals: z.array(z.enum(PROJECT_GOALS)).optional().default([]),
  designPreference: z.string().optional().default(""),
  referenceSites: z.string().optional().default(""),
  copywritingNeeded: z.boolean().optional().default(false),
  logoBrandAssetsReady: z.boolean().optional().default(false),
  hostingDomainStatus: z.enum(HOSTING_STATUS).optional().default("unsure"),
  timeline: z.enum(TIMELINE_OPTIONS).optional().default("flexible"),
  budgetRange: z.enum(BUDGET_RANGES).optional().default("undecided"),
  additionalNotes: z.string().optional().default(""),
  _honeypot: z.string().optional().default(""),
  _startTime: z.number().optional(),
});
