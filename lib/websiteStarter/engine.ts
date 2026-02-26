/**
 * Master Structural Stabilization: Single website starter engine.
 * Consolidates lib/aiWebsiteStarter.ts and lib/leads/aiWebsiteStarter.ts.
 * Preserves existing output shapes.
 */

import type { UnifiedTier } from "@/lib/pricing/unifiedTier";
import {
  generateAIStarterPackage,
  generateAIStarterPackageWithChanges,
  type AIStarterPackage,
} from "@/lib/aiWebsiteStarter";
import {
  generateWebsiteStarterPackage as generateDetailedPackage,
  aiStarterToMarkdown,
  type AiStarterPackage,
} from "@/lib/leads/aiWebsiteStarter";
import type { LeadFormData } from "@/lib/leads/leadSchema";

export type { AIStarterPackage, AiStarterPackage };

type SimpleFormData = {
  name?: string;
  email: string;
  company?: string;
  message?: string;
  industry?: string;
  hasDomain?: boolean;
  domainName?: string;
};

export type WebsiteStarterInput =
  | { variant: "simple"; form: SimpleFormData }
  | { variant: "detailed"; form: LeadFormData };

export type WebsiteStarterOutput = AIStarterPackage | AiStarterPackage;

/**
 * Single entry point for website starter generation.
 * Dispatches to simple (aiPackage) or detailed (starter package) based on variant.
 */
export async function generateWebsiteStarter(
  input: WebsiteStarterInput,
  _tier: UnifiedTier
): Promise<WebsiteStarterOutput> {
  if (input.variant === "simple") {
    return generateAIStarterPackage(input.form);
  }
  return generateDetailedPackage(input.form);
}

/**
 * Regenerate simple package with change request (for preview update flow).
 */
export async function generateWebsiteStarterWithChanges(
  existingPackage: AIStarterPackage,
  formData: SimpleFormData,
  changeRequest: string
): Promise<AIStarterPackage> {
  return generateAIStarterPackageWithChanges(existingPackage, formData, changeRequest);
}

export { aiStarterToMarkdown };
