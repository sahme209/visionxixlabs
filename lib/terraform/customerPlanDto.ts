import type {CustomerPlanProfile} from "./customerPlanTypes";
import type {PlanSummary} from "../iac/terraformPlanSummarizer";
import type {SavedPlanMetadata,SavedPlanProjection} from "./savedPlanDto";
export interface CustomerPlanConfigurationInput {
 environmentId:string;repository:CustomerPlanProfile["repository"];producer:CustomerPlanProfile["producer"];configuration:CustomerPlanProfile["configuration"];
 backend:Pick<CustomerPlanProfile["backend"],"region"|"bucket"|"key"|"lockTable">;artifacts:CustomerPlanProfile["artifacts"];connection:{id:string};
}
export interface CustomerPlanProfileExport {schema:"axiom.terraform.profile-export.v2";profile:CustomerPlanProfile;requestContentHash:string;targetDigest:string;toolchain:{version:string;executableDigest:string}}
export interface CustomerPlanProfileView {kind:"customer_plan_profile";profile:CustomerPlanProfile|null;status:"unconfigured"|"active"|"revoked";currentTarget:"not_observed"|"unavailable";approval:"unavailable";executionAllowed:false;permissions:{configure:boolean;import:boolean};profileExport?:CustomerPlanProfileExport}
export interface CustomerPlanImportInput {requestVersion:number;profileId:string;profileRevision:number;runId:string;runAttempt:number}
export interface CustomerPlanImported {kind:"customer_plan_imported";artifactId:string;reused:boolean;approval:"unavailable";executionAllowed:false}
export interface CustomerSavedPlanMetadata {
 id:string;binaryDigest:string;binaryBytes:number;environmentId:string;requestVersion:number;terraformVersion:string;createdAt:string;expiresAt:string;
 evidenceScope:"customer_ci_attested";inspection:"metadata_only"|"producer_bytes_verified";approval:"unavailable";currentTarget:"not_observed"|"unavailable"|"observed_match";executionEnabled:false;
 historical:boolean;profileId:string;profileRevision:number;runId:string;runAttempt:number;
}
export interface CustomerSavedPlanProjection extends CustomerSavedPlanMetadata {summary:PlanSummary;observedAt?:string;validity:"unexpired"|"expired"}
export type TerraformPlanMetadata=SavedPlanMetadata|CustomerSavedPlanMetadata;
export type TerraformPlanProjection=SavedPlanProjection|CustomerSavedPlanProjection;
export interface TerraformPlanReadData {plans:Array<TerraformPlanMetadata|TerraformPlanProjection>;truncated:boolean;producer:"unavailable"|"customer_ci_import";executionEnabled:false}
