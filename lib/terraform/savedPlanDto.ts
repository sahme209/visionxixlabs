import type { PlanSummary } from "../iac/terraformPlanSummarizer";

/** Public projection only; never include plan/state values or envelopes. */
export interface SavedPlanMetadata {
  id: string;
  binaryDigest: string;
  binaryBytes: number;
  environmentId: string;
  requestVersion: number;
  terraformVersion: string;
  createdAt: string;
  expiresAt: string;
  evidenceScope: "owned_local_fixture";
  inspection: "metadata_only" | "artifact_bytes_checked";
  approval: "unavailable";
  currentTarget: "unavailable";
  executionEnabled: false;
}
export interface SavedPlanProjection extends SavedPlanMetadata { summary: PlanSummary }
export interface SavedPlanReadData {
  plans: Array<SavedPlanMetadata | SavedPlanProjection>;
  truncated: boolean;
  producer: "unavailable";
  executionEnabled: false;
}
