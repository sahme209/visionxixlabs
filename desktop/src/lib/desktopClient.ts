import {createPlatformSourceClient,createPlatformHistoryClient,createPlatformReviewClient,createPlatformExecutionClient,createPlatformPreparationClient} from './platformReview';
import {releaseDeploymentApprovalPreviewSchema,type ReleaseDeploymentApprovalPreview} from '../../../lib/tauri/releaseDeploymentApprovalContract';
import {readAgentActionEligibility,mutateAgentActionExecution,type AgentActionMutation} from './agentActionExecutionControls';
import {readAgentActionExecution} from './agentActionExecutionRecovery';
import {createExecutionPolicyClient} from './governanceExecutionPolicy';
import {decodePolicyUploadBytes} from '../../../lib/governance/intelligence/documentText';
import {governanceDocumentHeadSchema,type GovernanceDocumentHead,governanceSourceDirectorySchema,type GovernanceSourceDirectory,governanceCollectionSchema,governanceDocumentLookupSchema,type GovernanceDocumentLookup,governanceDocumentUploadSchema,governanceDocumentReceiptSchema,type GovernanceDocumentReceipt,governanceEvidenceArtifactSchema,type GovernanceEvidenceArtifact,governanceProposalSchema,governanceRevisionListSchema,type GovernanceRevisionList,governanceEvidenceListSchema,governanceRevisionSchema,governanceDriftSchema,governanceRevisionId,type GovernanceEvidenceList,type GovernanceRevision,type GovernanceDrift} from './governanceIntelligence';
import {serviceNowWrittenObservationRequestSchema,type ServiceNowWrittenObservationRequest} from '../../../lib/releaseops/serviceNowWrittenLinkObservationContract';
import {serviceNowTerminalPolicyRequestSchema,serviceNowTerminalPolicyOptionsSchema,type ServiceNowTerminalPolicyRequest,type ServiceNowTerminalPolicyOptions} from '../../../lib/releaseops/serviceNowTerminalPolicyRequest';
import {associatedTicketActionsRequestSchema,isAssociatedTicketActionsResult,type AssociatedTicketActionsRequest,type AssociatedTicketActionsResult} from './associatedTicketActions';
import {ticketAssociationSelectionSchema,ticketReviewId,ticketReviewNonce,isTicketGovernanceReview,type TicketAssociationSelection,type TicketGovernanceReview} from './ticketGovernance';
import type {BotActionTaskReference} from '../../../lib/axiom/bot/actionTaskBindingContract';
import {slackNotificationsRequest,type SlackNotificationsResult,type SlackNotificationRequest,type SlackNotificationLookup} from "./slackNotificationsTransport";
import {connectedActionsRequest,type ConnectedActionLookup,type ConnectedActionsResult} from './connectedActionsTransport';
import {connectedActionsRequestSchema,type ConnectedActionsRequest} from '../../../lib/desktop/connectedActionsContract';
import {readSlackChannels,type SlackChannelsResult} from "./slackChannelsTransport";
import {githubReconnectChallengeSchema,githubReconnectConfirmationSchema,type GithubReconnectChallenge,type GithubReconnectConfirmation} from "../../../lib/desktop/githubInstallationReconnectContract";
import {deploymentPlanSchema,deploymentApprovalSchema,type DeploymentPlan,type DeploymentApproval,parseDeploymentExecutionState,type DeploymentExecutionState} from "../../../lib/tauri/releaseDeploymentExecutionContract";
import {parseProviderMergeExecutionState,type ProviderMergeExecutionState} from "../../../lib/tauri/releaseProviderMergeExecutionContract";
import {isReleaseWorkflowEvidenceResponse,type ReleaseWorkflowEvidenceResponse} from './releaseWorkflowEvidenceContract';
import {parseReleaseProviderMergeOperationResponse,type ProviderMergeOperationResponse} from '../../../lib/tauri/releaseProviderMergeContract';
import {isProviderMergeApprovalState,type ProviderMergeApprovalState} from './releaseProviderMergeApprovalContract';
import {isServiceNowTicketLifecycleState,isServiceNowMetadata,isServiceNowCloseOptions,type ServiceNowTicketLifecycleState,type ServiceNowMetadata,type ServiceNowCloseOptions} from './serviceNowTicketLifecycle';
import {isJiraTicketLifecycleState,isJiraCloseOptions,type JiraCloseOptions,type JiraTicketLifecycleState} from './jiraTicketLifecycle';
import type {JiraCreatePreviewInput} from './jiraTicketDiscovery';
import {isExecutionApprovalState,type ExecutionApprovalState} from './releaseExecutionApprovalContract';
import {releaseOperationPlanRequest,type ReleasePlanResult} from './releaseOperationPlanTransport';
import {isOperationPlanList,isOperationPlanMutation,isOperationPlanPreview,type OperationPlanList,type OperationPlanMutation,type OperationPlanPreview} from './releaseOperationPlanContract';
import {botPrEvidenceRequest} from './botPrEvidenceTransport';
import {isBotPrCapabilities,isBotPrRunList,isBotPrRunResponse,isBotPrEvidenceResponse,isBotPrRunId,isBotPrReleaseId,isBotPrUuid,isBotPrStart,type BotPrCapabilitiesDto,type BotPrRunListDto,type BotPrRunResponseDto,type BotPrEvidenceResponseDto,type BotPrStartDto} from '../../../lib/axiom/bot/pullRequestEvidenceDto';
import {botAiRequest} from './botAiTransport';
import {isBotAiEvidenceContext,isBotAiCapabilities,isBotAiRunList,isBotAiRunResponse,isBotAiResultResponse,isBotAiRunId,isBotAiModelId,type BotAiCapabilitiesDto,type BotAiRunListDto,type BotAiRunResponseDto,type BotAiResultResponseDto,type BotAiStartDto} from '../../../lib/axiom/bot/aiTaskDto';
import {readinessReportRequest} from './readinessReportTransport';
import {isReadinessCapabilities,isReadinessRunList,isReadinessRunResponse,isReadinessReportResponse,isReadinessRunId,type ReadinessCapabilitiesDto,type ReadinessRunListDto,type ReadinessRunResponseDto,type ReadinessReportResponseDto,type ReadinessStartDto} from '../../../lib/axiom/bot/readinessRunDto';
import {savedBotTaskRequest} from "./savedBotTaskTransport";
import {isSavedBotTaskId,isSavedBotTaskDetail,isSavedBotTaskList,isSavedBotTaskHistory,type SavedBotTaskResult,type SavedBotTaskListDto,type SavedBotTaskDetailDto,type SavedBotTaskHistoryDto,type SavedBotTaskCreateDto,type SavedBotTaskUpdateDto} from "../../../lib/axiom/bot/savedTaskContract";
import { isCloudOnboardingReadiness, type CloudOnboardingReadiness } from '../../../lib/cloud/onboardingReadinessContract';
import {isReleaseMergeTargets,isReleaseMergePlanEvidence,type ReleaseMergeTargets,type ReleaseMergePlanEvidence,type ReleaseMergeMethod} from "./releaseMergeContract";
import { isReleaseBatchWait, isReleaseBatchWaitState, type ReleaseBatchWait, type ReleaseBatchWaitState } from "./releaseBatchWaitContract";
import type { WorkflowDispatchInput } from "../../../lib/connectors/github/workflowDispatchInputDto";
import { AGENT_TOOL_ACTIVITY_FEATURE, type AgentToolActivity, type AgentMessageIssue } from "../../../lib/desktop/agentMessageStreamProtocol";
import type { AgentProfileId } from "../../../lib/axiom/agentRuntime/agentProfiles";
import type {DesktopUsageSummary} from "../../../lib/desktop/desktopBillingSummary";
import { assertDesktopNotAborted } from "./abortSignal";
import type { ModelPolicy } from "./aiProviderStatus";
import { isAwsEnrollmentChallenge, isDesktopAwsAccount, isDesktopAwsInventory, type AwsEnrollmentInput, type AwsEnrollmentChallenge, type DesktopAwsAccount, type DesktopAwsInventory } from "./awsEnrollmentContract";
/**
 * Desktop app's web client.
 *
 * Wraps the typed REST endpoints the web platform exposes. Honest by
 * design — when the desktop runtime isn't connected to a workspace, the
 * client returns a typed `disconnected` outcome rather than fabricating
 * data. UI surfaces show preview state accordingly.
 */

import {isCustomerPlanProfileView,isCustomerPlanImported} from "./terraformCustomerPlanContract";
import { setDesktopTransportCredential } from "./desktopTransport";
import type { TerraformPlanReadData,CustomerPlanProfileView,CustomerPlanConfigurationInput,CustomerPlanImportInput,CustomerPlanImported } from "../../../lib/terraform/customerPlanDto";
import type { AirflowRestartReviewDto } from "../../../lib/integrations/airflow/restartReviewDto";
import { parseDesktopIdentityResponse } from "./desktopIdentityResponse";
import { readAgentMessageStream } from "./agentMessageStream";
import { AGENT_STREAM_CONTENT_TYPE, isAgentMessageReply } from "../../../lib/desktop/agentMessageStreamProtocol";

const DEFAULT_API_BASE = "https://visionxixlabs.com";

export type DesktopConnectionState = "connecting" | "connected" | "disconnected" | "auth_required";

export interface DesktopClientConfig {
  apiBase: string;
  /** Bearer-style session token / API key. Optional during preview. */
  sessionToken?: string;
}

export type CollaborationValidationResult={ok:true;data:{status:'active'}}|{ok:false;error:string;errorCode:string;outcomeUnconfirmed:boolean;retryAllowed:false};
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type CredentialFailureKind = "unavailable" | "rejected" | "invalid" | "canceled";
export type CredentialVerificationResult = { ok: true; data: VerifiedDesktopIdentity } | { ok: false; error: string; failureKind: CredentialFailureKind };

export interface DesktopCommercialAccess {
  allowed: boolean;
  code: "active" | "production_access_required" | "payment_past_due" | "access_canceled";
  title: string;
  message: string;
  planTier: string;
  billingStatus: string;
  accessRequestPath: string;
  pricingPath: string;
  currentPeriodEndsAt?: string;
  cancelAtPeriodEnd?: boolean;
}

export interface VerifiedDesktopIdentity {
  /** Authenticated paired user only; optional for older services. Not action authority. */
  userId?: string;
  kind: "api_key" | "desktop_session";
  organizationId: string;
  email?: string;
  displayName?: string;
  role?: "owner" | "admin" | "operator" | "security_reviewer" | "finance_viewer" | "read_only";
  capabilities: string[];
  access: DesktopCommercialAccess;
}

export interface WorkspaceMember {
  userId: string;
  role: "owner" | "admin" | "operator" | "security_reviewer" | "finance_viewer" | "read_only";
  email: string;
  displayName?: string;
  acceptedAt: string | null;
  updatedAt: string;
}

export interface AgentSkillCatalogItem {
  id: string;
  name: string;
  description: string;
  category: "GitHub" | "Deployments" | "Governance" | "Identity";
  toolNames: string[];
  status: "enabled" | "disabled" | "not_installed";
  installedAt: string | null;
  updatedAt: string | null;
}

export interface AirflowDag { dagId: string; displayName: string; description: string | null; paused: boolean; owners: string[]; tags: string[] }
export interface AirflowDagRun { dagId: string; dagRunId: string; state: string; logicalDate: string | null; startedAt: string | null; endedAt: string | null }
export interface AirflowTaskInstance {
  taskId: string; mapIndex: number; tryNumber: number; state: string | null;
  startedAt: string | null; endedAt: string | null;
}
export interface AirflowTaskPage { tasks: AirflowTaskInstance[]; totalEntries: number; offset: number }

export interface AirflowAutomation {
  id: string; name: string; dagId: string; enabled: boolean; triggerMode: string; scheduleCron: string | null;
  requiredDagState: string; dependencyDagIds: string[]; actionType: string; repositoryFullName: string | null;
  sourceRef: string | null; pullRequestBase: string | null; pullRequestTitle: string | null; environmentId: string | null;
  approvalRequired: boolean; maxRetries: number; retryDelaySeconds: number; lastEvaluatedAt: string | null; nextScheduledAt: string | null;
}
export interface AirflowAutomationExecution { id: string; automationId: string; sourceDagId: string; sourceDagRunId: string; sourceDagState: string; status: string; attempt: number; errorCode: string | null; resultJson: unknown; createdAt: string }

export interface DeploymentExecutionEvidence {
  operation: "unknown";
  requestedOperation?: "service_restart";
  statusScope: "github_workflow";
  sourceArtifactVerified: false;
  applicationHealthVerified: false;
  rollbackImageVerified: false;
}

export interface DeploymentExecution {
  evidence?: DeploymentExecutionEvidence;
  id: string;
  environmentId: string;
  repositoryFullName: string;
  sourceRef: string | null;
  sourceKind: string | null;
  sourceCommitSha: string | null;
  branchPolicyId: string | null;
  pullRequestUrl: string | null;
  workflowRunId: string | null;
  workflowUrl: string | null;
  source: string;
  status: string;
  conclusion: string | null;
  rollbackStatus: string;
  lastObservedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface LegacyApiErrorBody {
  error?: string | { userMessage?: string };
  message?: string;
  issues?: Array<{ field?: string; message?: string }>;
}

export function legacyApiError(body: LegacyApiErrorBody, status: number): string {
  const issues = body.issues
    ?.filter((issue) => typeof issue.message === "string")
    .map((issue) => issue.field ? `${issue.field}: ${issue.message}` : issue.message)
    .filter((message): message is string => Boolean(message));
  if (issues?.length) return issues.join(" · ");
  if (body.error === "billing_customer_missing") {
    return "Billing is not set up for this workspace. Approved trial access does not require a card.";
  }
  if (typeof body.error === "object" && body.error?.userMessage) return body.error.userMessage;
  if (typeof body.message === "string" && body.message.trim()) return body.message;
  if (typeof body.error === "string") return body.error;
  return `HTTP ${status}`;
}

export function v1ApiError(body: Record<string, unknown>, status: number): string {
  const code = typeof body.error === "string" ? body.error : undefined;
  const requiredScope = typeof body.requiredScope === "string" ? body.requiredScope : undefined;
  switch (code) {
    case "missing_scope":
      return requiredScope
        ? `Your workspace credential lacks the ${requiredScope} permission. Ask a workspace administrator to issue the required scope.`
        : "Your workspace credential lacks permission for this action.";
    case "token_expired":
    case "token_revoked":
    case "unknown_token":
      return "Your workspace sign-in is no longer valid. Sign in again to continue.";
    case "commercial_access_required":
      return "This workspace does not have approved pilot or production access yet.";
    case "rate_limited":
      return "The service is temporarily rate-limiting requests. Wait a moment, then try again.";
    case "branch_policy_no_matching_ref":
      return "This branch or tag is not allowed for the selected environment.";
    case "branch_policy_release_tag_required":
      return "This environment requires a release tag. Select Tag and enter an existing GitHub tag.";
    case "branch_policy_pull_request_required":
      return "This environment requires a linked pull request number.";
    case "branch_policy_pull_request_not_merged":
      return "The linked pull request must be merged before deployment.";
    case "branch_policy_pull_request_ref_mismatch":
      return "The selected branch or tag does not point to the linked pull request commit.";
    case "branch_policy_codeowners_approval_required":
      return "GitHub CODEOWNERS enforcement and an approved review are required before deployment.";
    case "branch_policy_change_ticket_required":
      return "Add a CHG, INC, or REQ ticket reference to the linked pull request before deployment.";
    case "branch_policy_lookup_failed":
      return "Deployment policy could not be verified. Nothing was deployed; try again shortly.";
  }
  if (typeof body.message === "string" && body.message.trim()) return body.message;
  if (code) return code.replaceAll("_", " ");
  return `HTTP ${status}`;
}

// ---------------------------------------------------------------------------
// Typed result shapes (subset of the server API surface — keeps the
// desktop bundle lean by only typing fields it renders).
// ---------------------------------------------------------------------------

export interface CommandCenterStateLite {
  features: {
    awsScanMode: "live" | "preview" | "disabled";
    githubSyncMode: "live" | "preview" | "disabled";
    desktopMode: "live" | "preview" | "disabled";
    copilotEnabled: boolean;
    oauth: { google: boolean; github: boolean };
  };
  user: {
    isAuthenticated: boolean;
    email?: string;
    displayName?: string;
    workspaceLabel?: string;
  };
  headline: string;
}

export interface ControlPlaneStateLite {
  tenantId?: string;
  generatedAt: string;
  sourceMode: "live" | "preview" | "planned" | "blocked" | "empty";
  providers: {
    provider: "aws" | "azure" | "gcp";
    mode: "live" | "preview" | "disabled";
    connectionStatus: string;
    validationStatus: string;
    scanStatus: string;
    resourceCounts: Record<string, number>;
    topFindings: { ruleCode: string; risk: string; resourceRef: string }[];
    missingCapabilities: string[];
    sourceMode: string;
    confidence: number;
    nextAction?: { label: string; href?: string };
  }[];
  cloudInventory: {
    totalResources: number;
    byProvider: Record<string, number>;
  };
  securityPosture:    PostureLite;
  costPosture:        PostureLite;
  reliabilityPosture: PostureLite;
  releaseOpsPosture:  PostureLite;
  desktopPosture:     PostureLite;
  remediationPosture: PostureLite;
  simulationPosture:  PostureLite;
  approvalPosture:    PostureLite;
  validationPosture:  PostureLite;
  nextBestActions: {
    id: string;
    title: string;
    description: string;
    category: string;
    priority: number;
    riskLevel: "low" | "medium" | "high" | "critical";
    canRunNow: boolean;
    approvalRequired: boolean;
    route?: string;
  }[];
  blockers: { code: string; detail: string }[];
  risks: { code: string; detail: string }[];
}

export interface PostureLite {
  score: number;
  status: "healthy" | "warning" | "degraded" | "preview" | "blocked" | "unknown";
  summary: string;
  criticalItems: number;
  warnings: number;
  sourceMode: string;
  nextAction?: { label: string; href?: string };
}

export interface RemediationCandidateLite {
  id: string;
  title: string;
  description: string;
  provider: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  category: string;
  impactSummary: string;
  policyDecision: string;
  approvalRequirement: string;
  desktopReviewEligibility: string;
  status: string;
  sourceMode: string;
}

export interface RemediationPipelineLite {
  generatedAt: string;
  bundles: {
    candidate: RemediationCandidateLite;
    readiness: { decision: string; reason: string; safeNextAction?: { label: string; href?: string } };
    terraform: { fileName: string; hcl: string; manualReviewRequired: boolean; explanation: string };
    cli: { cli: string; command: string; manualReviewRequired: boolean; explanation: string };
    rollback: { rollbackAvailable: boolean; rollbackComplexity: string; rollbackSteps: { ordinal: number; detail: string }[] };
    verification: { manualOrAutomated: string; checks: { ordinal: number; title: string; execution: string }[] };
    finalStatus: string;
  }[];
  summary: {
    total: number;
    approvalGated: number;
    desktopEligible: number;
    blocked: number;
    byRisk: { low: number; medium: number; high: number; critical: number };
  };
}

export interface SimulationResultLite {
  id: string;
  changeSetId: string;
  status: "simulated" | "blocked" | "unsafe" | "incomplete" | "preview_only";
  summary: string;
  delta: { security: string; risk: string };
  impact: { directlyAffected: { resourceId: string; impactLevel: string }[]; indirectlyAffected: { resourceId: string }[]; overallImpact: string };
  rollbackFeasibility: string;
  blockers: { code: string; reason: string }[];
  approvalsRequired: { actionId: string; reason: string }[];
  safeNextAction: { label: string; href?: string };
  confidence: number;
}

export interface SimulationsBatchLite {
  generatedAt: string;
  twinId: string;
  results: SimulationResultLite[];
  summary: { total: number; simulated: number; preview_only: number; blocked: number; unsafe: number };
}

export interface OrchestrationLite {
  id: string;
  title: string;
  description?: string;
  provider: string;
  stage: string;
  status: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  sourceMode: string;
  safeNextAction?: { label: string; href?: string };
}

export interface OrchestrationListLite {
  generatedAt: string;
  orchestrations: OrchestrationLite[];
  approvals: {
    id: string;
    sourceType: string;
    sourceId: string;
    provider: string;
    riskLevel: string;
    changeSummary: string;
    status: string;
    expiresAt: string;
    approverRole: string;
  }[];
  activeLocks: { id: string; kind: string; resourceRef: string; expiresAt: string }[];
  summary: { total: number; approvalRequested: number; blocked: number; desktopReviewReady: number };
}

export interface SecurityScanLite {
  generatedAt: string;
  results: {
    id: string;
    title: string;
    description: string;
    severity: "info" | "low" | "medium" | "high" | "critical";
    category: string;
    scope: string;
    provider?: string;
    status: "pass" | "fail" | "warn" | "unknown" | "preview";
    evidence: string[];
    remediation?: string;
    source: "live" | "preview";
  }[];
  summary: { total: number; pass: number; fail: number; warn: number; unknown: number; preview: number; score: number };
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class DesktopClient {
  config: DesktopClientConfig;
  private contextRevision = 0;
  private readonly contextListeners = new Set<() => void>();
  private readonly validationHolds=new Map<'slack'|'teams',{base:string;token:string|undefined;revision:number;state:'pending'|'unknown';receipt?:string}>();
  private readonly consentReceipts=new Map<'slack'|'teams',{config:DesktopClientConfig;base:string;token:string|undefined;revision:number;receipt:string}>();
  private integrationStatusGeneration=0;
  private readonly validationListeners=new Set<()=>void>();
  integrationValidationRecoverySnapshot=()=>['slack','teams'].filter(p=>{const h=this.validationHolds.get(p as 'slack'|'teams');return h&&h.base===this.config.apiBase&&h.token===this.config.sessionToken&&h.revision===this.contextRevision}).join(',');
  subscribeIntegrationValidationRecovery=(listener:()=>void)=>{this.validationListeners.add(listener);return()=>{this.validationListeners.delete(listener)}};
  recordIntegrationValidationUnknown=(provider:'slack'|'teams')=>{this.validationHolds.set(provider,{base:this.config.apiBase,token:this.config.sessionToken,revision:this.contextRevision,state:'unknown',receipt:this.consentBaseline(provider)});this.integrationStatusGeneration++;for(const listener of this.validationListeners)listener()};
  private consentBaseline(provider:'slack'|'teams'){const b=this.consentReceipts.get(provider);return b?.config===this.config&&b.base===this.config.apiBase&&b.token===this.config.sessionToken&&b.revision===this.contextRevision?b.receipt:undefined}
  private async validateCollaboration(provider:'slack'|'teams'):Promise<CollaborationValidationResult>{
    const config=this.config,base=config.apiBase,token=config.sessionToken,revision=this.contextRevision;
    const unknown=():CollaborationValidationResult=>({ok:false,error:'Validation outcome is unconfirmed. Reload status and review consent before further validation.',errorCode:provider+'_validation_outcome_unknown',outcomeUnconfirmed:true,retryAllowed:false});
    const refused=(code:string):CollaborationValidationResult=>({ok:false,error:'Validation could not be completed. Reload status and review the provider consent.',errorCode:code,outcomeUnconfirmed:false,retryAllowed:false});
    if(this.integrationValidationRecoverySnapshot().split(',').includes(provider))return unknown();
    let origin:URL;try{origin=new URL(base)}catch{return refused('invalid_validation_context')}
    if(!token?.startsWith('axm.desk.')||/[\x00-\x20\x7f]/.test(token)||origin.username||origin.password||origin.search||origin.hash||origin.pathname!=='/'||!(origin.protocol==='https:'||origin.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(origin.hostname)))return refused('desktop_session_required');
    const hold={base,token,revision,state:'pending' as 'pending'|'unknown',receipt:this.consentBaseline(provider)};this.integrationStatusGeneration++;this.validationHolds.set(provider,hold);for(const listener of this.validationListeners)listener();
    const controller=new AbortController();let reader:ReadableStreamDefaultReader<Uint8Array>|undefined;let response:Response|undefined;
    const notify=()=>{for(const listener of this.validationListeners)listener()};
    const owns=()=>this.config===config&&this.config.apiBase===base&&this.config.sessionToken===token&&this.contextRevision===revision;
    let stop!:(error:Error)=>void;const stopped=new Promise<never>((_,reject)=>{stop=reject});
    const abort=()=>{controller.abort();try{void reader?.cancel().catch(()=>{})}catch{}stop(new Error('validation_stopped'))};
    const unsubscribe=this.subscribeContext(abort),timer=setTimeout(abort,25000);
    try{
      const work=(async()=>{
        const request=fetch(origin.origin+'/api/desktop/integrations/'+provider+'/validate',{method:'POST',credentials:'omit',redirect:'error',cache:'no-store',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:'{}',signal:controller.signal});
        void request.then(r=>{if(controller.signal.aborted)void r.body?.cancel().catch(()=>{})},()=>{});response=await request;
        if(!owns()||controller.signal.aborted||response.redirected||!response.body)throw new Error();
        const length=response.headers.get('content-length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)>32768))throw new Error();
        reader=response.body.getReader();const chunks:Uint8Array[]=[];let size=0;while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>32768)throw new Error();chunks.push(part.value)}
        const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
        const value:unknown=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));if(!owns()||controller.signal.aborted)throw new Error();
        const object=(v:unknown):v is Record<string,unknown>=>Boolean(v&&typeof v==='object'&&!Array.isArray(v));
        if(response.ok&&object(value)&&Object.keys(value).sort().join(',')==='data,ok'&&value.ok===true&&object(value.data)&&Object.keys(value.data).join(',')==='status'&&value.data.status==='active')return {ok:true as const,data:{status:'active' as const}};
        if(response.status>=400&&response.status<500&&object(value)&&Object.keys(value).sort().join(',')==='error,ok'&&value.ok===false&&typeof value.error==='string'&&['desktop_session_required',provider+'_authority_changed',provider+'_connection_changed',provider+'_not_connected'].includes(value.error))return refused(value.error);
        throw new Error();
      })();
      const result=await Promise.race([work,stopped]);if(this.validationHolds.get(provider)===hold)this.validationHolds.delete(provider);notify();return result;
    }catch{hold.state='unknown';notify();return unknown()}
    finally{clearTimeout(timer);unsubscribe();controller.abort();try{void reader?.cancel().catch(()=>{})}catch{}if(!reader)try{void response?.body?.cancel().catch(()=>{})}catch{}}
  }


  /** Local view invalidation only; carries no token and grants no authority. */
  getContextRevision = (): number => this.contextRevision;
  subscribeContext = (listener: () => void): (() => void) => {
    this.contextListeners.add(listener);
    return () => { this.contextListeners.delete(listener); };
  };
  private invalidateContext(): void {
    this.contextRevision += 1;
    for (const listener of this.contextListeners) {
      try { listener(); } catch { /* A view cannot block an authentication change. */ }
    }
  }

  constructor(config?: Partial<DesktopClientConfig>) {
    this.config = {
      apiBase: config?.apiBase ?? DEFAULT_API_BASE,
      sessionToken: config?.sessionToken,
    };
    if (config?.sessionToken) setDesktopTransportCredential(config.sessionToken);
  }

  setSession(token: string | undefined) {
    const changed = this.config.sessionToken !== token;
    this.config = { ...this.config, sessionToken: token };
    setDesktopTransportCredential(token);
    if (changed) this.invalidateContext();
  }

  setApiBase(base: string) {
    const changed = this.config.apiBase !== base;
    this.config = { ...this.config, apiBase: base };
    if (changed) this.invalidateContext();
  }

  private savedTaskContext() { return {getConfig:()=>this.config,getRevision:this.getContextRevision,subscribe:this.subscribeContext}; }
  botPrCapabilities(signal?:AbortSignal):Promise<SavedBotTaskResult<BotPrCapabilitiesDto>> {
    return botPrEvidenceRequest(this.savedTaskContext(),"GET","/api/desktop/bot/pr-evidence",undefined,isBotPrCapabilities,signal);
  }
  botPrRunsForTask(taskId:string,signal?:AbortSignal):Promise<SavedBotTaskResult<BotPrRunListDto>> {
    if(!isSavedBotTaskId(taskId))return Promise.resolve({ok:false,error:"Select a saved task first.",errorCode:"bot_pr_input_invalid",outcomeUnconfirmed:false});
    return botPrEvidenceRequest(this.savedTaskContext(),"GET",`/api/desktop/bot/pr-evidence?taskId=${taskId}`,undefined,(v):v is BotPrRunListDto=>isBotPrRunList(v)&&v.runs.every(r=>r.taskId===taskId),signal);
  }
  createBotPrEvidence(input:BotPrStartDto,signal?:AbortSignal):Promise<SavedBotTaskResult<BotPrRunResponseDto>> {
    if(!isBotPrStart(input))return Promise.resolve({ok:false,error:"Save the task and select an exact release target first.",errorCode:"bot_pr_input_invalid",outcomeUnconfirmed:false});
    return botPrEvidenceRequest(this.savedTaskContext(),"POST","/api/desktop/bot/pr-evidence",input,(v):v is BotPrRunResponseDto=>isBotPrRunResponse(v)&&v.run.taskId===input.taskId&&v.run.taskVersion===input.expectedVersion&&v.run.releaseId===input.releaseId&&v.run.releaseVersion===input.expectedReleaseVersion,signal);
  }
  getBotPrEvidence(id:string,signal?:AbortSignal):Promise<SavedBotTaskResult<BotPrEvidenceResponseDto>> {
    if(!isBotPrRunId(id))return Promise.resolve({ok:false,error:"Invalid evidence identifier.",errorCode:"bot_pr_input_invalid",outcomeUnconfirmed:false});
    return botPrEvidenceRequest(this.savedTaskContext(),"GET",`/api/desktop/bot/pr-evidence/${id}`,undefined,(v):v is BotPrEvidenceResponseDto=>isBotPrEvidenceResponse(v)&&v.run.id===id,signal);
  }
  findBotPrEvidence(clientRequestId:string,signal?:AbortSignal):Promise<SavedBotTaskResult<BotPrRunResponseDto>> {
    if(!isBotPrUuid(clientRequestId))return Promise.resolve({ok:false,error:"Invalid evidence request.",errorCode:"bot_pr_input_invalid",outcomeUnconfirmed:false});
    return botPrEvidenceRequest(this.savedTaskContext(),"GET",`/api/desktop/bot/pr-evidence?clientRequestId=${clientRequestId}`,undefined,isBotPrRunResponse,signal);
  }
  cancelBotPrEvidence(id:string,expectedRevision:number,signal?:AbortSignal):Promise<SavedBotTaskResult<BotPrRunResponseDto>> {
    if(!isBotPrRunId(id)||!Number.isSafeInteger(expectedRevision)||expectedRevision<0)return Promise.resolve({ok:false,error:"Check this evidence read before canceling.",errorCode:"bot_pr_input_invalid",outcomeUnconfirmed:false});
    return botPrEvidenceRequest(this.savedTaskContext(),"DELETE",`/api/desktop/bot/pr-evidence/${id}`,{expectedRevision},(v):v is BotPrRunResponseDto=>isBotPrRunResponse(v)&&v.run.id===id,signal);
  }
  botPrReleases(signal?:AbortSignal):Promise<SavedBotTaskResult<Array<{id:string;title:string;version:number;status:string}>>> {
    const validate=(v:unknown):v is Array<{id:string;title:string;version:number;status:string}>=>Array.isArray(v)&&v.length<=100&&v.every(r=>r&&typeof r==='object'&&isBotPrReleaseId(r.id)&&typeof r.title==='string'&&r.title.length<=500&&Number.isSafeInteger(r.version)&&r.version>=0&&typeof r.status==='string'&&r.status.length<=80)&&new Set(v.map(r=>r.id)).size===v.length;
    return botPrEvidenceRequest(this.savedTaskContext(),"GET","/api/desktop/deployments",undefined,validate,signal);
  }
  botPrTargets(releaseId:string,version:number,signal?:AbortSignal):Promise<SavedBotTaskResult<ReleaseMergeTargets>> {
    if(!isBotPrReleaseId(releaseId)||!Number.isSafeInteger(version)||version<0||version>2147483647)return Promise.resolve({ok:false,error:"Select a current release first.",errorCode:"bot_pr_input_invalid",outcomeUnconfirmed:false});
    return botPrEvidenceRequest(this.savedTaskContext(),"GET",`/api/desktop/deployments/${releaseId}/merge-targets?expectedVersion=${version}`,undefined,(v):v is ReleaseMergeTargets=>isReleaseMergeTargets(v,releaseId,version),signal);
  }
  botAiRunsForTask(taskId:string,signal?:AbortSignal):Promise<SavedBotTaskResult<BotAiRunListDto>> {
    if(!isSavedBotTaskId(taskId))return Promise.resolve({ok:false,error:"Select a saved task first.",errorCode:"bot_ai_input_invalid",outcomeUnconfirmed:false});
    return botAiRequest(this.savedTaskContext(),"GET",`/api/desktop/bot/ai-tasks?taskId=${taskId}`,undefined,(v):v is BotAiRunListDto=>isBotAiRunList(v)&&v.runs.every(run=>run.taskId===taskId),signal);
  }
  botAiCapabilities(signal?:AbortSignal):Promise<SavedBotTaskResult<BotAiCapabilitiesDto>> {
    return botAiRequest(this.savedTaskContext(),"GET","/api/desktop/bot/ai-tasks",undefined,isBotAiCapabilities,signal);
  }
  sendBotAiTask(input:BotAiStartDto,signal?:AbortSignal):Promise<SavedBotTaskResult<BotAiRunResponseDto>> {
    if(('evidenceContext' in input&&!isBotAiEvidenceContext(input.evidenceContext))||!isSavedBotTaskId(input.taskId)||!Number.isInteger(input.expectedVersion)||input.expectedVersion<0||input.expectedVersion>2147483647||input.kind!=="ai_task_response_v1"||!isBotAiModelId(input.modelId)||input.confirmSend!==true||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(input.clientRequestId))return Promise.resolve({ok:false,error:"Save the task and confirm the AI task scope first.",errorCode:"bot_ai_input_invalid",outcomeUnconfirmed:false});
    return botAiRequest(this.savedTaskContext(),"POST","/api/desktop/bot/ai-tasks",input,(v):v is BotAiRunResponseDto=>isBotAiRunResponse(v)&&v.run.taskId===input.taskId&&v.run.taskVersion===input.expectedVersion&&v.run.modelId===input.modelId,signal);
  }
  getBotAiRun(id:string,signal?:AbortSignal):Promise<SavedBotTaskResult<BotAiResultResponseDto>> {
    if(!isBotAiRunId(id))return Promise.resolve({ok:false,error:"Invalid AI task identifier.",errorCode:"bot_ai_input_invalid",outcomeUnconfirmed:false});
    return botAiRequest(this.savedTaskContext(),"GET",`/api/desktop/bot/ai-tasks/${id}`,undefined,(v):v is BotAiResultResponseDto=>isBotAiResultResponse(v)&&v.run.id===id,signal);
  }
  findBotAiRun(clientRequestId:string,signal?:AbortSignal):Promise<SavedBotTaskResult<BotAiRunResponseDto>> {
    if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(clientRequestId))return Promise.resolve({ok:false,error:"Invalid AI task request.",errorCode:"bot_ai_input_invalid",outcomeUnconfirmed:false});
    return botAiRequest(this.savedTaskContext(),"GET",`/api/desktop/bot/ai-tasks?clientRequestId=${encodeURIComponent(clientRequestId)}`,undefined,isBotAiRunResponse,signal);
  }
  cancelBotAiRun(id:string,expectedRevision:number,signal?:AbortSignal):Promise<SavedBotTaskResult<BotAiRunResponseDto>> {
    if(!isBotAiRunId(id)||!Number.isInteger(expectedRevision)||expectedRevision<0||expectedRevision>19)return Promise.resolve({ok:false,error:"Check the current AI task before canceling.",errorCode:"bot_ai_input_invalid",outcomeUnconfirmed:false});
    return botAiRequest(this.savedTaskContext(),"DELETE",`/api/desktop/bot/ai-tasks/${id}`,{expectedRevision},(v):v is BotAiRunResponseDto=>isBotAiRunResponse(v)&&v.run.id===id,signal);
  }
  readinessReportsForTask(taskId:string,signal?:AbortSignal):Promise<SavedBotTaskResult<ReadinessRunListDto>> {
    if(!isSavedBotTaskId(taskId))return Promise.resolve({ok:false,error:"Select a saved task first.",errorCode:"readiness_input_invalid",outcomeUnconfirmed:false});
    return readinessReportRequest(this.savedTaskContext(),"GET",`/api/desktop/bot/readiness-runs?taskId=${taskId}`,undefined,(v):v is ReadinessRunListDto=>isReadinessRunList(v)&&v.runs.every(run=>run.taskId===taskId),signal);
  }
  readinessCapabilities(signal?:AbortSignal):Promise<SavedBotTaskResult<ReadinessCapabilitiesDto>> {
    return readinessReportRequest(this.savedTaskContext(),"GET","/api/desktop/bot/readiness-runs",undefined,isReadinessCapabilities,signal);
  }
  createReadinessReport(input:ReadinessStartDto,signal?:AbortSignal):Promise<SavedBotTaskResult<ReadinessRunResponseDto>> {
    if(!isSavedBotTaskId(input.taskId)||!Number.isInteger(input.expectedVersion)||input.expectedVersion<0||input.expectedVersion>2147483647||input.adapter!=="workspace_readiness_v1"||input.confirmRecordedMetadata!==true||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(input.clientRequestId))return Promise.resolve({ok:false,error:"Save the task and confirm the report scope first.",errorCode:"readiness_input_invalid",outcomeUnconfirmed:false});
    return readinessReportRequest(this.savedTaskContext(),"POST","/api/desktop/bot/readiness-runs",input,(v):v is ReadinessRunResponseDto=>isReadinessRunResponse(v)&&v.run.taskId===input.taskId&&v.run.taskVersion===input.expectedVersion,signal);
  }
  getReadinessReport(id:string,signal?:AbortSignal):Promise<SavedBotTaskResult<ReadinessReportResponseDto>> {
    if(!isReadinessRunId(id))return Promise.resolve({ok:false,error:"Invalid report identifier.",errorCode:"readiness_input_invalid",outcomeUnconfirmed:false});
    return readinessReportRequest(this.savedTaskContext(),"GET",`/api/desktop/bot/readiness-runs/${id}`,undefined,(v):v is ReadinessReportResponseDto=>isReadinessReportResponse(v)&&v.run.id===id,signal);
  }
  findReadinessReport(clientRequestId:string,signal?:AbortSignal):Promise<SavedBotTaskResult<ReadinessRunResponseDto>> {
    if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(clientRequestId))return Promise.resolve({ok:false,error:"Invalid report request.",errorCode:"readiness_input_invalid",outcomeUnconfirmed:false});
    return readinessReportRequest(this.savedTaskContext(),"GET",`/api/desktop/bot/readiness-runs?clientRequestId=${encodeURIComponent(clientRequestId)}`,undefined,isReadinessRunResponse,signal);
  }
  cancelReadinessReport(id:string,expectedRevision:number,signal?:AbortSignal):Promise<SavedBotTaskResult<ReadinessRunResponseDto>> {
    if(!isReadinessRunId(id)||!Number.isInteger(expectedRevision)||expectedRevision<0||expectedRevision>20)return Promise.resolve({ok:false,error:"Check the current report before canceling.",errorCode:"readiness_input_invalid",outcomeUnconfirmed:false});
    return readinessReportRequest(this.savedTaskContext(),"DELETE",`/api/desktop/bot/readiness-runs/${id}`,{expectedRevision},(v):v is ReadinessRunResponseDto=>isReadinessRunResponse(v)&&v.run.id===id,signal);
  }
  listSavedBotTasks(cursor?:string,signal?:AbortSignal):Promise<SavedBotTaskResult<SavedBotTaskListDto>> {
    return savedBotTaskRequest(this.savedTaskContext(),"GET",`/api/desktop/bot/tasks${cursor?`?cursor=${encodeURIComponent(cursor)}`:""}`,undefined,isSavedBotTaskList,signal);
  }
  getSavedBotTask(id:string,signal?:AbortSignal):Promise<SavedBotTaskResult<SavedBotTaskDetailDto>> {
    if(!isSavedBotTaskId(id))return Promise.resolve({ok:false,error:"Invalid saved task.",errorCode:"saved_task_input_invalid",outcomeUnconfirmed:false});
    return savedBotTaskRequest(this.savedTaskContext(),"GET",`/api/desktop/bot/tasks/${id}`,undefined,(value):value is SavedBotTaskDetailDto=>isSavedBotTaskDetail(value)&&value.task.id===id,signal);
  }
  createSavedBotTask(input:SavedBotTaskCreateDto,signal?:AbortSignal):Promise<SavedBotTaskResult<SavedBotTaskDetailDto>> {
    return savedBotTaskRequest(this.savedTaskContext(),"POST","/api/desktop/bot/tasks",input,isSavedBotTaskDetail,signal);
  }
  updateSavedBotTask(id:string,input:SavedBotTaskUpdateDto,signal?:AbortSignal):Promise<SavedBotTaskResult<SavedBotTaskDetailDto>> {
    if(!isSavedBotTaskId(id))return Promise.resolve({ok:false,error:"Invalid saved task.",errorCode:"saved_task_input_invalid",outcomeUnconfirmed:false});
    return savedBotTaskRequest(this.savedTaskContext(),"PUT",`/api/desktop/bot/tasks/${id}`,input,(value):value is SavedBotTaskDetailDto=>isSavedBotTaskDetail(value)&&value.task.id===id,signal);
  }
  savedBotTaskHistory(id:string,beforeVersion?:number,signal?:AbortSignal):Promise<SavedBotTaskResult<SavedBotTaskHistoryDto>> {
    if(!isSavedBotTaskId(id)||beforeVersion!==undefined&&(!Number.isInteger(beforeVersion)||beforeVersion<0||beforeVersion>2147483647))return Promise.resolve({ok:false,error:"Invalid saved-task history.",errorCode:"saved_task_input_invalid",outcomeUnconfirmed:false});
    return savedBotTaskRequest(this.savedTaskContext(),"GET",`/api/desktop/bot/tasks/${id}/history${beforeVersion===undefined?"":`?beforeVersion=${beforeVersion}`}`,undefined,(value):value is SavedBotTaskHistoryDto=>isSavedBotTaskHistory(value)&&value.taskId===id,signal);
  }

  listDeploymentTerraformPlans(id: string): Promise<ApiResult<TerraformPlanReadData>> {
    return this.get(`/api/desktop/deployments/${encodeURIComponent(id)}/terraform-plans`);
  }

  getDeploymentTerraformPlan(id: string, artifactId: string): Promise<ApiResult<TerraformPlanReadData>> {
    return this.get(`/api/desktop/deployments/${encodeURIComponent(id)}/terraform-plans/${encodeURIComponent(artifactId)}`);
  }

  async getDeploymentTerraformProfile(id:string):Promise<ApiResult<CustomerPlanProfileView>> {
    const result=await this.terraformPlanRequest<unknown>("GET",`/api/desktop/deployments/${encodeURIComponent(id)}/terraform-plan-profile`);
    if(!result.ok)return result;return isCustomerPlanProfileView(result.data,id)?{ok:true,data:result.data}:{ok:false,error:"Customer plan profile response is unavailable."};
  }
  async configureDeploymentTerraformProfile(id:string,input:{requestVersion:number;expectedRevision:number;profileInput:CustomerPlanConfigurationInput}):Promise<ApiResult<CustomerPlanProfileView>> {
    const result=await this.terraformPlanRequest<unknown>("POST",`/api/desktop/deployments/${encodeURIComponent(id)}/terraform-plan-profile`,{operation:input.expectedRevision===0?"configure":"revise",...input});
    if(!result.ok)return result;return isCustomerPlanProfileView(result.data,id)&&result.data.status==="active"&&result.data.profile?.revision===input.expectedRevision+1&&result.data.profile.requestVersion===input.requestVersion?{ok:true,data:result.data}:{ok:false,error:"Customer plan profile changed. Refresh and review again."};
  }
  async revokeDeploymentTerraformProfile(id:string,input:{requestVersion:number;profileId:string;expectedRevision:number}):Promise<ApiResult<CustomerPlanProfileView>> {
    const result=await this.terraformPlanRequest<unknown>("POST",`/api/desktop/deployments/${encodeURIComponent(id)}/terraform-plan-profile`,{operation:"revoke",...input});
    if(!result.ok)return result;return isCustomerPlanProfileView(result.data,id)&&result.data.status==="revoked"&&result.data.profile?.id===input.profileId&&result.data.profile.revision===input.expectedRevision+1?{ok:true,data:result.data}:{ok:false,error:"Customer plan revocation changed. Refresh and review again."};
  }
  async importDeploymentTerraformPlan(id:string,input:CustomerPlanImportInput):Promise<ApiResult<CustomerPlanImported>> {
    const result=await this.terraformPlanRequest<unknown>("POST",`/api/desktop/deployments/${encodeURIComponent(id)}/terraform-plans/import`,input);
    if(!result.ok)return result;return isCustomerPlanImported(result.data)?{ok:true,data:result.data}:{ok:false,error:"Customer plan evidence response is unavailable."};
  }
  private async terraformPlanRequest<T>(method:"GET"|"POST",path:string,body?:unknown):Promise<ApiResult<T>> {
    if(!this.config.sessionToken?.startsWith("axm.desk."))return {ok:false,error:"A currently paired desktop session is required for customer plan evidence."};
    try{
      const response=await fetch(`${this.config.apiBase}${path}`,{method,credentials:"omit",headers:{...this.headers(),...(method==="POST"?{"Content-Type":"application/json"}:{})},...(method==="POST"?{body:JSON.stringify(body)}:{})});
      const value=await response.json().catch(()=>null) as {ok?:boolean;data?:T;error?:unknown}|null;
      if(response.ok&&value?.ok===true&&value.data!==undefined)return {ok:true,data:value.data};
      return {ok:false,error:value?.error==="customer_plan_environment_immutable_new_request"?"customer_plan_environment_immutable_new_request":response.status===503?"customer_plan_storage_or_producer_unavailable":"customer_plan_refresh_and_review_required"};
    }catch{return {ok:false,error:"customer_plan_service_unavailable"};}
  }

  /** True when the desktop is not connected to an authenticated workspace. */
  isPreviewMode = false;

  /** True when a supported desktop credential is loaded for verification. */
  hasAuth(): boolean {
    return Boolean(this.config.sessionToken);
  }

  /**
   * A credential being present in the OS vault is not proof that it is still
   * valid. Startup calls this before mounting any authenticated workspace UI.
   */
  async verifyCurrentCredential(): Promise<CredentialVerificationResult> {
    return this.verifyCredentialCandidate(this.config.sessionToken);
  }

  /** Verify without changing transport or vault; never return raw service errors. */
  async verifyCredentialCandidate(token: string | undefined, signal?: AbortSignal): Promise<CredentialVerificationResult> {
    const failure = (failureKind: CredentialFailureKind): CredentialVerificationResult => ({ ok: false, failureKind,
      error: failureKind === "unavailable" ? "The workspace service could not be reached. Try again."
        : failureKind === "canceled" ? "Sign-in canceled."
        : "The saved sign-in could not be verified. Sign in again." });
    if (signal?.aborted) return failure("canceled");
    if (!token || (!token.startsWith("vxlk_") && !token.startsWith("axm.desk."))) return failure("invalid");
    const controller = new AbortController();
    let settleBoundary: (result: CredentialVerificationResult) => void = () => {};
    const boundary = new Promise<CredentialVerificationResult>(resolve => {settleBoundary = resolve;});
    const onAbort = () => {controller.abort(); settleBoundary(failure("canceled"));};
    signal?.addEventListener("abort", onAbort, {once: true});
    const timer = setTimeout(() => {controller.abort(); settleBoundary(failure(signal?.aborted ? "canceled" : "unavailable"));}, 15000);
    try {
      const operation = async (): Promise<CredentialVerificationResult> => {
        try {
          const response = await fetch(`${this.config.apiBase}/api/desktop/access`, {
            headers: { ...this.headers(), Authorization: `Bearer ${token}` }, credentials: "include", signal: controller.signal,
          });
          if (controller.signal.aborted) return failure(signal?.aborted ? "canceled" : "unavailable");
          if (!response.ok) return failure(response.status === 401 || response.status === 403 ? "rejected"
            : response.status >= 500 || response.status === 408 || response.status === 429 ? "unavailable" : "invalid");
          const body = await response.json().catch(() => null);
          if (controller.signal.aborted) return failure(signal?.aborted ? "canceled" : "unavailable");
          const identity = body?.ok ? parseDesktopIdentityResponse(body.data) : null;
          const expectedKind = token.startsWith("vxlk_") ? "api_key" : "desktop_session";
          return identity && identity.kind === expectedKind ? { ok: true, data: identity } : failure("invalid");
        } catch {return failure(signal?.aborted ? "canceled" : "unavailable");}
      };
      return await Promise.race([operation(), boundary]);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      controller.abort();
    }
  }

  desktopBillingPortal(): Promise<ApiResult<{ url: string }>> {
    return this.post("/api/desktop/billing/portal", {});
  }

  usageSummary(): Promise<ApiResult<DesktopUsageSummary>> {
    return this.get("/api/desktop/usage-summary");
  }

  /** HMAC-verified webhook delivery history for the paired workspace. */
  webhookDeliveries<T>(): Promise<ApiResult<T>> {
    return this.get("/api/desktop/webhook-deliveries");
  }

  /** Paired-session AGI cockpit; never falls back to dashboard cookies. */
  agiCockpit<T>(): Promise<ApiResult<T>> {
    return this.get("/api/desktop/agi-cockpit");
  }

  /** Manually trigger the tenant-scoped AGI sweep with the current desktop role. */
  runAgiCockpit<T>(): Promise<ApiResult<T>> {
    return this.post("/api/desktop/agi-cockpit", {});
  }

  /** Tenant-scoped AI provider observability for a paired desktop session. */
  aiCallLog<T>(args?: { engineName?: string; take?: number }): Promise<ApiResult<T>> {
    const params = new URLSearchParams();
    if (args?.engineName) params.set("engineName", args.engineName);
    if (args?.take) params.set("take", String(args.take));
    const query = params.toString();
    return this.get(`/api/desktop/ai-call-log${query ? `?${query}` : ""}`);
  }

  /** Immutable ReleaseOps audit events for the paired workspace. */
  releaseAudit<T>(args?: { kind?: string; limit?: number }): Promise<ApiResult<T>> {
    const params = new URLSearchParams();
    if (args?.kind) params.set("kind", args.kind);
    if (args?.limit) params.set("limit", String(args.limit));
    const query = params.toString();
    return this.get(`/api/desktop/release-audit${query ? `?${query}` : ""}`);
  }

  /** Decision-learning signals scoped to the paired workspace. */
  learningLoop<T>(): Promise<ApiResult<T>> {
    return this.get("/api/desktop/learning-loop");
  }

  /**
   * Phase 399 — call GET /api/v1/whoami. Returns the workspace + scopes
   * + quota snapshot, or a precise auth-failure code. Doesn't fall back
   * to mock — when whoami fails, callers should show the "paste API key"
   * UI instead of pretending to be authenticated.
   */
  async v1Whoami(): Promise<ApiResult<{
    apiKey: { id: string; env: "live" | "test"; scopes: ReadonlyArray<string> };
    organization: { id: string; planTier: string };
    quota: {
      monthlyLimit: number | null;
      currentCalls: number;
      remaining: number | null;
      ratio: number | null;
      nearLimit: boolean;
    };
    serverTimeSec: number;
  }>> {
    return this.getV1("/api/v1/whoami");
  }

  /**
   * Phase 393 — call GET /api/v1/release-gate. Returns the current
   * release-gate verdict so the desktop dashboard can render a deploy-
   * ready badge.
   */
  async v1ReleaseGate(): Promise<ApiResult<{
    hasRun: boolean;
    gate?: {
      passed: boolean;
      passRate: number;
      averageScore: number;
      summary: string;
      blockers: ReadonlyArray<{ kind: string; message: string }>;
    };
    regressionCount?: number;
    improvementCount?: number;
  }>> {
    return this.getV1("/api/v1/release-gate");
  }

  /**
   * POST /api/v1/pipelines/runs — trigger a new coding pipeline run.
   * Required scope: pipeline:trigger.
   *
   * When `idempotencyKey` is supplied, the platform deduplicates retries
   * Stripe-style (Phase 402): same key + same body returns the cached
   * response, same key + different body returns 422, in-flight returns
   * 409. Pass a UUID generated client-side per click.
   */
  async v1TriggerCodingRun(args: {
    instruction: string;
    repoRef: string;
    branchHint?: string;
    metadata?: Record<string, string>;
    idempotencyKey?: string;
  }): Promise<ApiResult<{
    runId: string;
    correlationId: string;
    status: string;
    pollUrl: string;
  }>> {
    return this.postV1(
      "/api/v1/pipelines/runs",
      {
        pipelineId: "ai_coding",
        instruction: args.instruction,
        repoRef: args.repoRef,
        ...(args.branchHint ? { branchHint: args.branchHint } : {}),
        ...(args.metadata ? { metadata: args.metadata } : {}),
      },
      args.idempotencyKey ? { "Idempotency-Key": args.idempotencyKey } : undefined,
    );
  }

  /**
   * GET /api/v1/pipelines/runs/[id] — single pipeline run + stages.
   * Required scope: pipeline:read. 404 when the runId doesn't exist
   * OR belongs to a different workspace (both collapsed to
   * "run_not_found" to prevent cross-tenant probing).
   */
  async v1GetPipelineRun(runId: string): Promise<ApiResult<{
    run: {
      id: string;
      pipelineId: string;
      status: "queued" | "running" | "succeeded" | "failed" | "awaiting_approval";
      triggeredBy: string;
      correlationId: string;
      startedAt: string;
      completedAt: string | null;
      errorSummary: string | null;
      stages: ReadonlyArray<{
        id: string;
        stageId: string;
        stageKind: string;
        ordering: number;
        status: string;
        completedAt: string | null;
        errorMessage: string | null;
      }>;
    };
  }>> {
    return this.getV1(`/api/v1/pipelines/runs/${encodeURIComponent(runId)}`);
  }

  /**
   * GET /api/v1/connectors/health — Phase 407.
   * Per-connector health (closed-union status + reason + ratio + age).
   * Required scope: pipeline:read.
   */
  async v1ConnectorsHealth(): Promise<ApiResult<{
    generatedAt: string;
    summary: {
      healthy: number;
      degraded: number;
      stale: number;
      auth_failed: number;
      rate_limited: number;
    };
    connectors: ReadonlyArray<{
      name: string;
      category: "cloud" | "vcs" | "db" | "monitoring" | "ide";
      status: "healthy" | "degraded" | "stale" | "auth_failed" | "rate_limited";
      stage: "auth" | "rate_limit" | "staleness" | "ratio" | "ok";
      reason: string;
      successRatio: number | null;
      ageMs: number | null;
      recentSuccessCount: number;
      recentErrorCount: number;
    }>;
  }>> {
    return this.getV1("/api/v1/connectors/health");
  }

  async v1ConnectorSetupDigest<T>(): Promise<ApiResult<T>> {
    return this.getV1<T>("/api/v1/connectors/setup-digest");
  }

  /**
   * POST /api/v1/pipelines/runs/[id]/decide — Phase 406-decide.
   * Records a vote on a pipeline run paused at an awaiting_approval
   * stage. Required scope: pipeline:trigger.
   *
   * Pipeline gates default to requiredApprovers=2: a single call from
   * the desktop records ONE vote and returns `isTerminal: false` until
   * a second authenticated machine principal votes. A key is not proof
   * of a human; caller labels cannot create additional voter identities.
   */
  async v1DecideApproval(args: {
    runId: string;
    decision: "approved" | "rejected";
    reason?: string;
    approverUserId?: string;
  }): Promise<ApiResult<{
    runId: string;
    approvalId: string;
    vote: "approved" | "rejected";
    snapshotStatus: "pending" | "approved" | "rejected" | "expired";
    approvedCount: number;
    rejectedCount: number;
    requiredApprovers: number;
    isTerminal: boolean;
    decidedAt: string | null;
    stageTransitioned: boolean;
  }>> {
    return this.postV1(
      `/api/v1/pipelines/runs/${encodeURIComponent(args.runId)}/decide`,
      {
        decision: args.decision,
        ...(args.reason ? { reason: args.reason } : {}),
        ...(args.approverUserId ? { approverUserId: args.approverUserId } : {}),
      },
    );
  }

  /**
   * GET /api/v1/pipelines/runs — list recent pipeline runs for the
   * authenticated workspace. Required scope: pipeline:read.
   * Default page size 25, max 100. Filter by status with `status`.
   */
  async v1ListPipelineRuns(args?: {
    limit?: number;
    cursor?: string;
    status?: "running" | "succeeded" | "failed" | "awaiting_approval";
  }): Promise<ApiResult<{
    runs: ReadonlyArray<{
      id: string;
      pipelineId: string;
      status: string;
      triggeredBy: string;
      correlationId: string;
      startedAt: string;
      completedAt: string | null;
      errorSummary: string | null;
      stageCount: number;
    }>;
    nextCursor: string | null;
  }>> {
    const params = new URLSearchParams();
    if (args?.limit)  params.set("limit",  String(args.limit));
    if (args?.cursor) params.set("cursor", args.cursor);
    if (args?.status) params.set("status", args.status);
    const qs = params.toString();
    return this.getV1(`/api/v1/pipelines/runs${qs ? "?" + qs : ""}`);
  }

  // ── Command center / control plane ────────────────────────────────
  commandCenterState():  Promise<ApiResult<CommandCenterStateLite>>   { return this.get("/api/command-center"); }

  async controlPlaneState(): Promise<ApiResult<ControlPlaneStateLite>> {
    // When a desktop session token is paired, prefer the Bearer-authenticated
    // endpoint so the call works cross-origin (cookie auth would fail).
    if (this.config.sessionToken) {
      const wrapped = await this.get<{ state: ControlPlaneStateLite }>("/api/desktop/state");
      if (wrapped.ok && wrapped.data?.state) {
        this.isPreviewMode = false;
        return { ok: true, data: wrapped.data.state };
      }
    }
    const res = await this.get<ControlPlaneStateLite>("/api/control-plane/state");
    if (res.ok) { this.isPreviewMode = false; return res; }
    this.isPreviewMode = true;
    return res;
  }
  controlPlaneActions(): Promise<ApiResult<{ nextBestActions: ControlPlaneStateLite["nextBestActions"] }>> { return this.get("/api/control-plane/next-actions"); }
  controlPlaneRefresh(): Promise<ApiResult<{ state: ControlPlaneStateLite }>> { return this.post("/api/control-plane/refresh", {}); }

  async startAwsReadOnlyEnrollment(input: AwsEnrollmentInput): Promise<ApiResult<AwsEnrollmentChallenge>> {
    const result = await this.cloudEnrollmentRequest<unknown>("POST", "/api/desktop/cloud/aws/enrollment", input);
    if (!result.ok) return result;
    return isAwsEnrollmentChallenge(result.data) ? { ok: true, data: result.data } : { ok: false, error: "The service returned an invalid AWS enrollment challenge." };
  }

  async completeAwsReadOnlyEnrollment(attemptId: string, externalId: string): Promise<ApiResult<{ account: DesktopAwsAccount }>> {
    const result = await this.cloudEnrollmentRequest<{ account?: unknown }>("POST", `/api/desktop/cloud/aws/enrollment/${encodeURIComponent(attemptId)}/complete`, { externalId });
    if (!result.ok) return result;
    return isDesktopAwsAccount(result.data?.account) ? { ok: true, data: { account: result.data.account } } : { ok: false, error: "The service returned an invalid AWS account verification result." };
  }

  async cloudOnboardingReadiness(): Promise<ApiResult<CloudOnboardingReadiness>> {
    const result = await this.cloudEnrollmentRequest<unknown>("GET", "/api/desktop/cloud/onboarding-readiness");
    if (!result.ok) return result;
    return isCloudOnboardingReadiness(result.data) ? { ok: true, data: result.data } : { ok: false, error: "Cloud setup status is unavailable." };
  }

  async desktopCloudAccounts(): Promise<ApiResult<{ accounts: DesktopAwsAccount[] }>> {
    const result = await this.cloudEnrollmentRequest<{ accounts?: unknown }>("GET", "/api/desktop/cloud/accounts");
    if (!result.ok) return result;
    return Array.isArray(result.data?.accounts) && result.data.accounts.every(isDesktopAwsAccount)
      ? { ok: true, data: { accounts: result.data.accounts } }
      : { ok: false, error: "The service returned an invalid cloud account list." };
  }

  async disconnectDesktopAwsAccount(accountId: string, expectedVersion: number): Promise<ApiResult<{ account: DesktopAwsAccount }>> {
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) return { ok: false, error: "Refresh the AWS connection before disconnecting it." };
    const result = await this.cloudEnrollmentRequest<{ account?: unknown }>("POST", `/api/desktop/cloud/accounts/${encodeURIComponent(accountId)}/disconnect`, { expectedVersion });
    if (!result.ok) return result;
    const account = result.data?.account;
    return isDesktopAwsAccount(account) && account.id === accountId && !account.connected
      && account.connectionVersion >= expectedVersion && account.connectionVersion <= expectedVersion + 1
      ? { ok: true, data: { account } }
      : { ok: false, error: "The service did not confirm this AWS connection was disconnected. Refresh its state." };
  }

  async desktopAwsInventory(accountId: string): Promise<ApiResult<DesktopAwsInventory>> {
    const result = await this.cloudEnrollmentRequest<unknown>("GET", `/api/desktop/cloud/accounts/${encodeURIComponent(accountId)}/inventory`);
    if (!result.ok) return result;
    return isDesktopAwsInventory(result.data) ? { ok: true, data: result.data } : { ok: false, error: "The service returned an invalid bounded AWS inventory result." };
  }

  private async cloudEnrollmentRequest<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<ApiResult<T>> {
    // This enrollment requires a paired desktop bearer, never browser-cookie fallback.
    if (!this.config.sessionToken?.startsWith("axm.desk.")) return { ok: false, error: "A browser-paired desktop session is required for cloud enrollment." };
    const controller = new AbortController();
    let response: Response | undefined;
    let timedOut = false;
    const cancelBody = (value: Response) => {
      try { void value.body?.cancel().catch(() => {}); } catch { /* Already consumed or locked. */ }
    };
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      deadline = setTimeout(() => {
        timedOut = true;
        reject(new Error("aws_enrollment_timeout"));
        controller.abort();
      }, 25000);
    });
    try {
      // Race the complete read as well as aborting fetch: headers alone do not
      // complete a request, and a stalled body must not keep the UI busy.
      const operation = (async () => {
        const received = await fetch(`${this.config.apiBase}${path}`, {
          method, headers: { ...this.headers(), ...(method === "POST" ? { "Content-Type": "application/json" } : {}) },
          credentials: "omit", ...(method === "POST" ? { body: JSON.stringify(body) } : {}), signal: controller.signal,
        });
        response = received;
        if (controller.signal.aborted) {
          cancelBody(received);
          throw new Error("aws_enrollment_timeout");
        }
        const payload = await received.json().catch(() => null) as { ok?: boolean; data?: T; message?: unknown } | null;
        if (received.ok && payload?.ok === true && payload.data !== undefined) return { ok: true as const, data: payload.data };
        return { ok: false as const, error: typeof payload?.message === "string" ? payload.message : `Cloud enrollment is unavailable (HTTP ${received.status}).` };
      })();
      return await Promise.race([operation, timeout]);
    } catch {
      return { ok: false, error: timedOut
        ? "The AWS connection request timed out. Its outcome is unconfirmed; refresh connection state before trying again."
        : "The cloud enrollment service could not be reached. Its outcome is unconfirmed; refresh connection state before trying again." };
    } finally {
      clearTimeout(deadline);
      controller.abort();
      if (response) cancelBody(response);
    }
  }

  // ── Cloud connectors ──────────────────────────────────────────────
  awsValidate(input: { roleArn: string; externalId: string; region: string; requestLive?: boolean }): Promise<ApiResult<unknown>> {
    return this.post("/api/aws/validate", input);
  }
  awsScan(input: { roleArn: string; externalId: string; region: string; requestLive?: boolean }): Promise<ApiResult<unknown>> {
    return this.post("/api/aws/scan", input);
  }
  azureValidate(input: { tenantId: string; clientId: string; clientSecret: string; subscriptionId: string }): Promise<ApiResult<unknown>> {
    return this.post("/api/azure/validate", input);
  }
  gcpValidate(input: { projectId: string; serviceAccountJson: string }): Promise<ApiResult<unknown>> {
    return this.post("/api/gcp/validate", input);
  }

  // ── Security scanner ──────────────────────────────────────────────
  async securityScan(): Promise<ApiResult<SecurityScanLite>> {
    const res = await this.post<SecurityScanLite>("/api/security-scan", {});
    this.isPreviewMode = !res.ok;
    return res;
  }

  // ── Remediation ───────────────────────────────────────────────────
  async remediationPlan(): Promise<ApiResult<RemediationPipelineLite>> {
    const res = await this.post<RemediationPipelineLite>("/api/remediation/plan", {});
    this.isPreviewMode = !res.ok;
    return res;
  }
  remediationCandidates(): Promise<ApiResult<{ candidates: RemediationCandidateLite[] }>> { return this.post("/api/remediation/candidates", {}); }

  // ── Simulation ────────────────────────────────────────────────────
  async simulationsBatch(): Promise<ApiResult<SimulationsBatchLite>> {
    const res = await this.post<SimulationsBatchLite>("/api/simulations/create", {});
    this.isPreviewMode = !res.ok;
    return res;
  }
  simulationFromRemediation(candidateId: string): Promise<ApiResult<{ result: SimulationResultLite }>> {
    return this.post("/api/simulations/from-remediation", { candidateId });
  }

  // ── Orchestration ─────────────────────────────────────────────────
  async orchestration(): Promise<ApiResult<OrchestrationListLite>> {
    const res = await this.get<OrchestrationListLite>("/api/orchestration");
    this.isPreviewMode = !res.ok;
    return res;
  }
  decideApproval(id: string, decision: "approved" | "rejected", reason?: string): Promise<ApiResult<unknown>> {
    return this.post(`/api/orchestration/approvals/${encodeURIComponent(id)}/decide`, { decision, reason });
  }

  // ── Deployment operations ─────────────────────────────────────────
  private connectedActionRecovery=new Map<'teams'|'linear',{config:DesktopClientConfig;revision:number;input:ConnectedActionsRequest}>();
  connectedActionPending(provider:'teams'|'linear'){const p=this.connectedActionRecovery.get(provider);return p?.config===this.config&&p.revision===this.contextRevision?p.input:undefined}
  async listConnectedActions(provider:'teams'|'linear',lookup?:ConnectedActionLookup,signal?:AbortSignal):Promise<ConnectedActionsResult>{
    const config=this.config,revision=this.contextRevision,pending=this.connectedActionPending(provider);
    if(pending&&lookup&&'targets'in lookup)return{ok:false,error:'Recover the saved action before loading a different target.',errorCode:'connected_action_recovery_required',outcomeUnconfirmed:true};
    const recovery=pending?pending.action==='request'?{intentId:pending.intentId}:{id:pending.id}:lookup;
    const r=await connectedActionsRequest(this.savedTaskContext(),provider,undefined,recovery,signal);
    if(r.ok&&this.config===config&&this.contextRevision===revision&&pending){
      if(pending.action==='request'){const intent=r.data.actions[0]?.intent;if(!intent||(intent.sourceTask?.taskId!==pending.sourceTask?.taskId||intent.sourceTask?.taskVersion!==pending.sourceTask?.expectedVersion)||intent.intentId!==pending.intentId||intent.kind!==pending.kind||intent.teamId!==pending.teamId||['title','description','text','channelId','issueId','stateId'].some(k=>k in pending&&(pending as unknown as Record<string,unknown>)[k]!==undefined&&(pending as unknown as Record<string,unknown>)[k]!==((intent as unknown as Record<string,unknown>)[k])))return{ok:false,error:'The saved draft does not match this request. Keep it for recovery.',errorCode:'connected_action_recovery_required',outcomeUnconfirmed:true}}
      this.connectedActionRecovery.delete(provider);
    }return r;
  }
  async mutateConnectedAction(provider:'teams'|'linear',input:ConnectedActionsRequest,signal?:AbortSignal):Promise<ConnectedActionsResult>{
    if(this.connectedActionPending(provider))return{ok:false,error:'Recover the saved action before another change.',errorCode:'connected_action_recovery_required',outcomeUnconfirmed:true};
    const parsed=connectedActionsRequestSchema.safeParse(input);if(!parsed.success)return{ok:false,error:'Review the exact action details.',errorCode:'invalid_connected_action',outcomeUnconfirmed:false};
    const config=this.config,revision=this.contextRevision;this.connectedActionRecovery.set(provider,{config,revision,input:structuredClone(parsed.data)});
    const r=await connectedActionsRequest(this.savedTaskContext(),provider,parsed.data,undefined,signal);
    if((r.ok||input.action==='request'&&!r.ok&&r.errorCode==='bot_action_task_changed'&&!r.outcomeUnconfirmed)&&this.config===config&&this.contextRevision===revision)this.connectedActionRecovery.delete(provider);return r;
  }
  async retrySavingConnectedActionDraft(provider:'teams'|'linear',signal?:AbortSignal):Promise<ConnectedActionsResult>{
    const pending=this.connectedActionPending(provider);if(!pending||pending.action!=='request')return{ok:false,error:'Only saving the same unconfirmed draft can be retried. Execution is never retried.',errorCode:'connected_action_recovery_required',outcomeUnconfirmed:true};
    this.connectedActionRecovery.delete(provider);return this.mutateConnectedAction(provider,pending,signal);
  }
  private slackNotificationRecovery:{config:DesktopClient['config'];revision:number;requestId?:string;requestKey?:string;hold:boolean}|undefined;
  slackNotificationNeedsReload=()=>this.slackNotificationRecovery?.config===this.config&&this.slackNotificationRecovery?.revision===this.contextRevision&&this.slackNotificationRecovery.hold===true;
  slackNotificationRequestId(channelId:string,text:string,sourceTask?:BotActionTaskReference){const previous=this.slackNotificationRecovery,key=JSON.stringify(sourceTask?[channelId,text,sourceTask.taskId,sourceTask.expectedVersion]:[channelId,text]);if(previous?.config===this.config&&previous.revision===this.contextRevision&&previous.requestId){if(previous.requestKey!==key)return null;return previous.requestId}return crypto.randomUUID()}
  slackNotificationPendingDraft(channelId:string,sourceTask?:BotActionTaskReference){const p=this.slackNotificationRecovery;if(p?.config!==this.config||p.revision!==this.contextRevision||!p.requestKey)return '';try{const [channel,text,taskId,version]=JSON.parse(p.requestKey);return taskId===sourceTask?.taskId&&version===sourceTask?.expectedVersion&&channel===channelId&&typeof text==='string'?text:''}catch{return ''}}
  async listSlackNotifications(lookup?:SlackNotificationLookup,signal?:AbortSignal):Promise<SlackNotificationsResult>{
    const config=this.config,revision=this.contextRevision,pending=this.slackNotificationRecovery,owned=pending?.config===config&&pending.revision===revision;
    const r=await slackNotificationsRequest(this.savedTaskContext(),undefined,owned&&pending.requestId?{clientRequestId:pending.requestId}:lookup,signal);
    if(r.ok&&this.config===config&&this.contextRevision===revision&&owned){
      if(pending.requestId&&!r.data.approvals.some(a=>a.clientRequestId===pending.requestId&&JSON.stringify(a.intent.sourceTask?[a.intent.channelId,a.intent.text,a.intent.sourceTask.taskId,a.intent.sourceTask.taskVersion]:[a.intent.channelId,a.intent.text])===pending.requestKey))return{ok:false,error:'The earlier notification draft could not be found. Keep its original request and reload history before another action.'};
      this.slackNotificationRecovery=undefined;
    }
    return r;
  }
  async mutateSlackNotification(input:SlackNotificationRequest,signal?:AbortSignal):Promise<SlackNotificationsResult>{
    if(this.slackNotificationNeedsReload())return{ok:false,error:'Reload notification history before another action.'};
    const config=this.config,revision=this.contextRevision,previous=this.slackNotificationRecovery;
    if(input.action==='request'&&previous?.config===config&&previous.revision===revision&&previous.requestId&&(input.clientRequestId!==previous.requestId||JSON.stringify(input.sourceTask?[input.channelId,input.text,input.sourceTask.taskId,input.sourceTask.expectedVersion]:[input.channelId,input.text])!==previous.requestKey))return{ok:false,error:'The earlier draft outcome is unresolved. Reload its saved history before starting a different draft.'};
    this.slackNotificationRecovery={config,revision,hold:true,...(input.action==='request'?{requestId:input.clientRequestId,requestKey:JSON.stringify(input.sourceTask?[input.channelId,input.text,input.sourceTask.taskId,input.sourceTask.expectedVersion]:[input.channelId,input.text])}:previous?.config===config&&previous.revision===revision?{requestId:previous.requestId,requestKey:previous.requestKey}:{})};
    const r=await slackNotificationsRequest(this.savedTaskContext(),input,undefined,signal);if(!r.ok&&input.action==='request'&&r.errorCode==='bot_action_task_changed'&&this.config===config&&this.contextRevision===revision)this.slackNotificationRecovery=undefined;if(r.ok&&this.config===config&&this.contextRevision===revision)this.slackNotificationRecovery=input.action!=='request'&&previous?.config===config&&previous.revision===revision&&previous.requestId?{...previous,hold:false}:undefined;return r;
  }
  listSlackChannels(cursor?:string,signal?:AbortSignal):Promise<SlackChannelsResult>{return readSlackChannels(this.savedTaskContext(),cursor,signal)}
  private githubReconnectHold:{config:DesktopClient['config'];revision:number}|undefined;
  githubReconnectNeedsReload=()=>this.githubReconnectHold?.config===this.config&&this.githubReconnectHold?.revision===this.contextRevision;
  async reloadGitHubReconnectStatus(){const config=this.config,revision=this.contextRevision;const r=await this.integrationStatus();if(r.ok&&this.config===config&&this.contextRevision===revision)this.githubReconnectHold=undefined;return r}
  verifyExistingGitHubConnection(signal?:AbortSignal):Promise<ReleasePlanResult<GithubReconnectChallenge>> {
    if(this.githubReconnectNeedsReload())return Promise.resolve({ok:false,error:'Reload GitHub status before verifying again.',outcomeUnconfirmed:false});
    return releaseOperationPlanRequest(this.savedTaskContext(),'POST','/api/desktop/integrations/github/reconnect',{action:'verify'},(v):v is GithubReconnectChallenge=>githubReconnectChallengeSchema.safeParse(v).success,signal);
  }
  async confirmExistingGitHubConnection(challengeId:string,signal?:AbortSignal):Promise<ReleasePlanResult<GithubReconnectConfirmation>> {
    if(this.githubReconnectNeedsReload()||!/^github_reconnect_[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(challengeId))return{ok:false,error:'Reload GitHub status before reconnecting.',outcomeUnconfirmed:false};
    const config=this.config,revision=this.contextRevision;this.githubReconnectHold={config,revision};
    const r=await releaseOperationPlanRequest(this.savedTaskContext(),'POST','/api/desktop/integrations/github/reconnect',{action:'confirm',challengeId,expectedVersion:0},(v):v is GithubReconnectConfirmation=>githubReconnectConfirmationSchema.safeParse(v).success,signal);
    if(r.ok&&this.config===config&&this.contextRevision===revision)this.githubReconnectHold=undefined;return r;
  }
  async integrationStatus(): Promise<ApiResult<{
    configuration?: Record<"github" | "slack" | "teams" | "linear", boolean>;
    cloud: Array<{
      provider: "aws" | "azure" | "gcp";
      status: string;
      lastTransitionAt: string | null;
    }>;
    github: { status: string; repositorySelection: string };
    collaboration: Array<{
      provider: "slack" | "teams" | "linear";
      status: string;
      lastValidatedAt: string | null;
      recoveryReceipt?: string;
    }>;
  }>> {
    const config=this.config,base=config.apiBase,token=config.sessionToken,revision=this.contextRevision,generation=++this.integrationStatusGeneration;
    const result=await this.get<{configuration?:Record<"github"|"slack"|"teams"|"linear",boolean>;cloud:Array<{provider:"aws"|"azure"|"gcp";status:string;lastTransitionAt:string|null}>;github:{status:string;repositorySelection:string};collaboration:Array<{provider:"slack"|"teams"|"linear";status:string;lastValidatedAt:string|null;recoveryReceipt?:string}>}>("/api/desktop/integrations");
    if(result.ok&&this.config===config&&this.config.apiBase===base&&this.config.sessionToken===token&&this.contextRevision===revision&&generation===this.integrationStatusGeneration&&Array.isArray(result.data.collaboration)){
      let changed=false;
      for(const provider of ['slack','teams'] as const){const rows=result.data.collaboration.filter(r=>r&&r.provider===provider);if(rows.length!==1)continue;const row=rows[0];if(typeof row.recoveryReceipt!=='string'||!/^[a-f0-9]{64}$/.test(row.recoveryReceipt))continue;
        const hold=this.validationHolds.get(provider);
        if(hold){if(hold.base!==config.apiBase||hold.token!==config.sessionToken||hold.revision!==revision||hold.state!=='unknown'||!hold.receipt||hold.receipt===row.recoveryReceipt||row.status!=='pending')continue;this.validationHolds.delete(provider);changed=true}
        this.consentReceipts.set(provider,{config,base,token,revision,receipt:row.recoveryReceipt});
      }
      if(changed)for(const listener of this.validationListeners)listener();
    }
    return result;
  }

  startIntegrationConnection(provider: "github" | "slack" | "teams" | "linear"): Promise<ApiResult<{ consentUrl: string }>> {
    return this.post(`/api/desktop/integrations/${encodeURIComponent(provider)}/connect`, {});
  }

  listAgentSkills(): Promise<ApiResult<{ skills: AgentSkillCatalogItem[]; storageAvailable?: boolean }>> {
    return this.get("/api/desktop/agent/skills");
  }

  microsoftLearn(input: {action: "check"} | {action: "search"; query: string}): Promise<ApiResult<{searchAvailable: true} | {results: Array<{title: string; excerpt: string; url: string}>}>> {
    return this.post("/api/desktop/mcp/microsoft-learn", input);
  }

  updateAgentSkill(skillId: string, action: "install" | "enable" | "disable" | "remove"): Promise<ApiResult<{ skillId: string; status: string }>> {
    return this.post("/api/desktop/agent/skills", { skillId, action });
  }

  validateGitHubReadOnly(): Promise<ApiResult<{ status: "validated_read_only" }>> {
    return this.post("/api/desktop/integrations/github/validate", {});
  }

  validateSlackConnection(): Promise<CollaborationValidationResult> {
    return this.validateCollaboration("slack");
  }

  validateTeamsConnection(): Promise<CollaborationValidationResult> {
    return this.validateCollaboration("teams");
  }

  validateLinearConnection(): Promise<ApiResult<{ status: "active" }>> {
    return this.post("/api/desktop/integrations/linear/validate", {});
  }

  airflowConnection(): Promise<ApiResult<{ connected: boolean; status: string; connectionId?: string; connectionUpdatedAt?: string; baseUrl?: string; version?: string | null; dagCount?: number | null; authMode?: string; lastValidatedAt?: string }>> {
    return this.get("/api/desktop/airflow/connection");
  }

  saveAirflowConnection(input: { baseUrl: string; authMode: "username_password" | "token"; username?: string; password?: string; token?: string }): Promise<ApiResult<{ status: string; baseUrl: string; version: string | null; dagCount: number }>> {
    return this.put("/api/desktop/airflow/connection", input);
  }

  disconnectAirflow(): Promise<ApiResult<{ disconnected: boolean }>> { return this.delete("/api/desktop/airflow/connection"); }
  /** Read-only Batches providers. Connecting grants observation only. */
  batchConnection(provider: BatchProviderId): Promise<ApiResult<BatchConnectionState>> { return this.get(`/api/desktop/batch/${provider}/connection`); }
  saveBatchConnection(provider: BatchProviderId, input: { baseUrl: string; token: string; namespace?: string }): Promise<ApiResult<BatchConnectionState>> { return this.put(`/api/desktop/batch/${provider}/connection`, input); }
  disconnectBatchConnection(provider: BatchProviderId): Promise<ApiResult<{ provider: BatchProviderId; disconnected: boolean }>> { return this.delete(`/api/desktop/batch/${provider}/connection`); }
  listAirflowDags(): Promise<ApiResult<{ dags: AirflowDag[] }>> { return this.get("/api/desktop/airflow/dags"); }
  listAirflowTaskInstances(dagId: string, dagRunId: string, offset = 0): Promise<ApiResult<AirflowTaskPage>> {
    return this.get(`/api/desktop/airflow/dags/${encodeURIComponent(dagId)}/runs/${encodeURIComponent(dagRunId)}/tasks?offset=${offset}`);
  }

  listAirflowDagRuns(dagId: string): Promise<ApiResult<{ runs: AirflowDagRun[] }>> { return this.get(`/api/desktop/airflow/dags/${encodeURIComponent(dagId)}/runs`); }
  triggerAirflowDag(dagId: string): Promise<ApiResult<{ run: AirflowDagRun }>> { return this.post(`/api/desktop/airflow/dags/${encodeURIComponent(dagId)}/runs`, {}); }
  listAirflowAutomations(): Promise<ApiResult<{ automations: AirflowAutomation[]; executions: AirflowAutomationExecution[] }>> { return this.get("/api/desktop/airflow/automations"); }
  createAirflowAutomation(input: Record<string, unknown>): Promise<ApiResult<{ automation: AirflowAutomation }>> { return this.post("/api/desktop/airflow/automations", input); }
  setAirflowAutomationEnabled(id: string, enabled: boolean): Promise<ApiResult<{ automation: AirflowAutomation }>> { return this.patch(`/api/desktop/airflow/automations/${encodeURIComponent(id)}`, { enabled }); }
  getAirflowExecutionReview(id: string): Promise<ApiResult<AirflowRestartReviewDto>> { return this.get(`/api/desktop/airflow/executions/${encodeURIComponent(id)}/review`); }
  approveAirflowExecution(id: string, expectedReviewDigest?: string): Promise<ApiResult<Record<string, unknown>>> { return this.post(`/api/desktop/airflow/executions/${encodeURIComponent(id)}/approve`, expectedReviewDigest === undefined ? {} : { expectedReviewDigest }); }
  rejectAirflowExecution(id: string): Promise<ApiResult<{ rejected: boolean }>> { return this.post(`/api/desktop/airflow/executions/${encodeURIComponent(id)}/reject`, {}); }

  createGithubBranch(input: { repositoryFullName: string; baseBranch: string; newBranchName: string }): Promise<ApiResult<{ ref: string; sha: string }>> {
    return this.post("/api/desktop/github/branch", input);
  }

  commitGithubFile(input: { repositoryFullName: string; branch: string; path: string; content: string; message: string }): Promise<ApiResult<{ sha: string; htmlUrl: string }>> {
    return this.post("/api/desktop/github/commit", input);
  }

  openGithubPullRequest(input: { repositoryFullName: string; head: string; base: string; title: string; body?: string }): Promise<ApiResult<{ number: number; htmlUrl: string }>> {
    return this.post("/api/desktop/github/pull-request", input);
  }

  mintGithubCloneToken(input: { repositoryFullName: string; purpose?: "clone" | "pull" | "push"; branch?: string }): Promise<ApiResult<{ cloneUrl: string }>> {
    return this.post("/api/desktop/github/clone-token", input);
  }

  listGithubRepositories(): Promise<ApiResult<{
    repositories: Array<{
      id: string;
      name: string;
      fullName: string;
      owner: string;
      defaultBranch: string;
      visibility: "private" | "public";
    }>;
    totalCount: number;
    truncated: boolean;
  }>> {
    return this.get("/api/desktop/github/repositories");
  }

  listGithubBranches(repositoryFullName: string): Promise<ApiResult<{
    branches: Array<{ name: string; commitSha: string; protected: boolean }>;
    truncated: boolean;
  }>> {
    return this.get(`/api/desktop/github/branches?repositoryFullName=${encodeURIComponent(repositoryFullName)}`);
  }

  listGithubFiles(repositoryFullName: string, branch: string): Promise<ApiResult<{
    files: Array<{ path: string; size: number }>;
    truncated: boolean;
  }>> {
    return this.get(`/api/desktop/github/files?repositoryFullName=${encodeURIComponent(repositoryFullName)}&branch=${encodeURIComponent(branch)}`);
  }

  listGithubWorkflows(repositoryFullName: string, ref: string): Promise<ApiResult<{
    repositoryFullName: string; ref: string;
    files: Array<{ name: string; path: string; blobSha: string }>;
  }>> {
    return this.get(`/api/desktop/github/workflows?repositoryFullName=${encodeURIComponent(repositoryFullName)}&branch=${encodeURIComponent(ref)}`);
  }

  getGithubWorkflowInputs(repositoryFullName: string, ref: string, path: string): Promise<ApiResult<{
    source: { repositoryFullName: string; ref: string; path: string; blobSha: string };
    inputs: WorkflowDispatchInput[];
  }>> {
    return this.get(`/api/desktop/github/workflow-inputs?repositoryFullName=${encodeURIComponent(repositoryFullName)}&branch=${encodeURIComponent(ref)}&path=${encodeURIComponent(path)}`);
  }

  listEnvironments(): Promise<ApiResult<{
    environments: Array<{ id: string; slug: string; name: string; tier: string; displayOrder: number; hasApprovalPolicy: boolean; createdAtIso: string }>;
  }>> {
    return this.get("/api/desktop/environments");
  }

  createEnvironment(input: { slug: string; name: string; tier: string }): Promise<ApiResult<{ id: string; slug: string; name: string; tier: string; created: boolean }>> {
    return this.post("/api/desktop/environments", input);
  }

  getDeploymentTarget(environmentId: string): Promise<ApiResult<{
    target: { roleArn: string; region: string; ecsCluster: string; ecsService: string } | null;
  }>> {
    return this.get(`/api/desktop/environments/deployment-target?environmentId=${encodeURIComponent(environmentId)}`);
  }

  saveDeploymentTarget(input: { environmentId: string; roleArn: string; region: string; ecsCluster: string; ecsService: string }): Promise<ApiResult<{ roleArn: string; region: string; ecsCluster: string; ecsService: string }>> {
    return this.post("/api/desktop/environments/deployment-target", input);
  }

  triggerAwsDeploy(input: { repositoryFullName: string; environmentId: string; sourceRef: string; sourceKind: "branch" | "tag"; pullRequestNumber?: number; promotedFromExecutionId?: string; emergencyBypass?: boolean; bypassReason?: string; idempotencyKey: string }): Promise<ApiResult<{ evidence?: DeploymentExecutionEvidence; dispatched: boolean; execution: DeploymentExecution | null; trackingAvailable: boolean; policyId: string | null; sourceRef: string; sourceKind: "branch" | "tag"; governanceMode: "policy_enforced" | "emergency_bypass" }>> {
    const { idempotencyKey, ...body } = input;
    return this.post("/api/desktop/environments/deploy", body, { "Idempotency-Key": idempotencyKey });
  }

  preflightAwsDeploy(input: { repositoryFullName: string; environmentId: string; sourceRef: string; sourceKind: "branch" | "tag"; pullRequestNumber?: number; promotedFromExecutionId?: string; emergencyBypass?: boolean; bypassReason?: string }): Promise<ApiResult<{ evidence?: DeploymentExecutionEvidence; ready: true; policyId: string | null; sourceCommitSha: string; pullRequestUrl: string | null; governanceMode: "policy_enforced" | "emergency_bypass" }>> {
    return this.post("/api/desktop/environments/deploy/preflight", input);
  }

  listDeploymentExecutions(environmentId?: string): Promise<ApiResult<{ executions: DeploymentExecution[] }>> {
    const query = environmentId ? `?environmentId=${encodeURIComponent(environmentId)}` : "";
    return this.get(`/api/desktop/environments/deployments${query}`);
  }

  observeDeploymentExecution(id: string): Promise<ApiResult<DeploymentExecution>> {
    return this.get(`/api/desktop/environments/deployments/${encodeURIComponent(id)}`);
  }

  createAgentConversation(): Promise<ApiResult<{ id: string; title: string | null; createdAt: string }>> {
    return this.post("/api/desktop/agent/conversations", {});
  }

  listAgentConversations(options?: { query?: string; cursor?: string }): Promise<ApiResult<{
    conversations: Array<{ id: string; title: string | null; turnCount: number; createdAt: string; updatedAt: string }>;
    nextCursor?: string | null;
    historyQueryVersion?: number;
  }>> {
    const query = new URLSearchParams();
    if (options?.query) query.set("q", options.query);
    if (options?.cursor) query.set("cursor", options.cursor);
    return this.get(`/api/desktop/agent/conversations${query.size ? `?${query}` : ""}`);
  }

  renameAgentConversation(conversationId: string, title: string, expectedTitle: string | null): Promise<ApiResult<{id: string; title: string}>> {
    return this.post(`/api/desktop/agent/conversations/${encodeURIComponent(conversationId)}/rename`, {title, expectedTitle});
  }

  getAgentConversation(conversationId: string): Promise<ApiResult<{
    id: string; title: string | null;
    turns: Array<{ id: string; role: string; content: string; actionProposalId: string | null; createdAt: string }>;
    actions: Array<{ id: string; requiresIndependentReviewer?: boolean; toolName: string; argsJson: unknown; riskLevel: string; status: string; resultJson: unknown; errorMessage: string | null; createdAt: string }>;
  }>> {
    return this.get(`/api/desktop/agent/conversations/${encodeURIComponent(conversationId)}`);
  }

  sendAgentMessage(conversationId: string, message: string, preferredProvider?: string, workspaceContext?: {
    repositoryFullName?: string;
    branch?: string;
    environmentId?: string;
    filePath?: string;
    mode?: "chat" | "code";
    operationMode?: "inspect" | "engineer" | "deepops";
    maxDecisionSteps?: number;
    agentProfile?: AgentProfileId;
  }, preferredModel?: string, streaming?: { signal: AbortSignal; onDraft: (text: string) => void; onActivity?: (activity: AgentToolActivity) => void }): Promise<ApiResult<{
    reply: string;
    issue?: AgentMessageIssue;
    proposal: { id: string; requiresIndependentReviewer?: boolean; toolName: string; argsJson: unknown; riskLevel: string; status: string } | null;
    /** Provider-reported token evidence, not a settled customer credit charge. */
    usage: { decisionSteps: number; inputTokens: number | null; outputTokens: number | null; totalTokens: number | null } | null;
  }>> {
    const path = `/api/desktop/agent/conversations/${encodeURIComponent(conversationId)}/messages`;
    const body = { message, preferredProvider, workspaceContext, ...(preferredModel ? { preferredModel } : {}), ...(streaming?.onActivity ? {streamFeatures: [AGENT_TOOL_ACTIVITY_FEATURE]} : {}) };
    if (!streaming) return this.post(path, body);
    return this.sendStreamingAgentMessage(path, body, streaming);
  }

  private async sendStreamingAgentMessage(path: string, body: unknown, streaming: { signal: AbortSignal; onDraft: (text: string) => void; onActivity?: (activity: AgentToolActivity) => void }) {
    const context = this.config;
    const controller = new AbortController();
    // Relay cancellation without depending on newer WKWebView AbortSignal.any.
    const onAbort = () => controller.abort();
    streaming.signal.addEventListener("abort", onAbort, { once: true });
    if (streaming.signal.aborted) controller.abort();
    const signal = controller.signal;
    const unsubscribe = this.subscribeContext(() => controller.abort());
    const assertOwned = () => {
      if (context !== this.config) controller.abort();
      assertDesktopNotAborted(signal);
    };
    try {
      assertOwned();
      const response = await fetch(`${context.apiBase}${path}`, {
        method: "POST", credentials: "include", redirect: "error", signal,
        headers: { ...this.headers(), "content-type": "application/json", Accept: AGENT_STREAM_CONTENT_TYPE },
        body: JSON.stringify(body),
      });
      assertOwned();
      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        return { ok: false as const, error: legacyApiError(json, response.status) };
      }
      // Already-serving older releases may return their ordinary JSON response
      // to Accept. Consume that SAME response; never dispatch a fallback call.
      const data = response.headers.get("content-type")?.split(";")[0] === AGENT_STREAM_CONTENT_TYPE
        ? await readAgentMessageStream(response, text => { assertOwned(); streaming.onDraft(text); }, signal, activity => { assertOwned(); streaming.onActivity?.(activity); })
        : await response.json().then(value => {
          if (value?.ok !== true || !isAgentMessageReply(value.data)) throw new Error("invalid_agent_reply");
          return value.data;
        });
      assertOwned();
      return { ok: true as const, data: { ...data, usage: data.usage ?? null } };
    } catch {
      return { ok: false as const, error: signal.aborted ? "Request stopped. Any completed work remains recorded; reload the conversation before trying again." : "The response was interrupted. No success was assumed. Reload the conversation before trying again." };
    } finally { unsubscribe(); streaming.signal.removeEventListener("abort", onAbort); controller.abort(); }
  }

  readAgentActionEligibility(proposalId: string, signal?: AbortSignal) {
    return readAgentActionEligibility(this.savedTaskContext(), proposalId, signal);
  }

  mutateAgentActionExecution(input: AgentActionMutation, signal?: AbortSignal) {
    return mutateAgentActionExecution(this.savedTaskContext(), input, signal);
  }

  readAgentActionExecution(proposalId: string, signal?: AbortSignal) {
    return readAgentActionExecution(this.savedTaskContext(), proposalId, signal);
  }

  approveAgentAction(actionId: string): Promise<ApiResult<{ id: string; status: string; errorMessage: string | null }>> {
    return this.post(`/api/desktop/agent/actions/${encodeURIComponent(actionId)}/approve`, {});
  }

  rejectAgentAction(actionId: string): Promise<ApiResult<{ id: string; status: string }>> {
    return this.post(`/api/desktop/agent/actions/${encodeURIComponent(actionId)}/reject`, {});
  }

  listRepositories(): Promise<ApiResult<{ generatedAt: string; repositories: Array<{ id: string; provider: "github" | "gitlab" | "azuredevops" | "other"; displayName: string; remoteUrl: string; defaultBranch: string; protectionStrength: "strong" | "weak" | "none"; flavorBadge: string | null; openPrCount: number; recentTagCount: number; lastWorkflow: { name: string; state: "queued" | "in_progress" | "completed"; conclusion: string | null; startedAtIso: string | null } | null }>; summary: { total: number; byProvider: Record<string, number>; weakProtection: number } }>> {
    return this.get("/api/desktop/repositories");
  }

  registerRepository(input: { provider: string; remoteOwner: string; remoteName: string; remoteUrl?: string; defaultBranch?: string; repoFlavor?: string }): Promise<ApiResult<{ id: string; displayName: string; created: boolean }>> {
    return this.post("/api/desktop/repositories", input);
  }

  listBranchPolicies(): Promise<ApiResult<{
    policies: Array<{ id: string; repositoryId: string; environmentId: string; branchPattern: string; requirePrLink: boolean; requireReleaseTag: boolean; requireCodeowners: boolean; requireChangeTicket: boolean; requireTestsPassing: boolean; requirePromotionFromEnvironmentId: string | null }>;
  }>> {
    return this.get("/api/desktop/branch-policies");
  }

  createBranchPolicy(input: { repositoryId: string; environmentId: string; branchPattern: string; requirePrLink?: boolean; requireReleaseTag?: boolean; requireCodeowners?: boolean; requireChangeTicket?: boolean; requireTestsPassing?: boolean; requirePromotionFromEnvironmentId?: string }): Promise<ApiResult<{ id: string }>> {
    return this.post("/api/desktop/branch-policies", input);
  }

  listWorkspaceMembers(): Promise<ApiResult<{ currentUserId: string; currentRole: string | null; capabilities: string[]; members: WorkspaceMember[] }>> {
    return this.get("/api/desktop/workspace-members");
  }

  updateWorkspaceMemberRole(userId: string, role: Exclude<WorkspaceMember["role"], "owner">): Promise<ApiResult<{ userId: string; role: string; updatedAt: string }>> {
    return this.patch("/api/desktop/workspace-members", { userId, role });
  }

  listIdentityProviders(): Promise<ApiResult<{
    providers: Array<{ id: string; protocol: string; status: string; issuerOrEntityId: string; managedDomains: string[]; requireMfaClaim: boolean; revokedAt: string | null }>;
  }>> {
    return this.get("/api/desktop/identity-providers");
  }

  createIdentityProvider(input: {
    protocol: string; issuerOrEntityId: string; metadataDocument: string; managedDomains: string[];
    roleMapping: Array<{ claimKey: string; claimValue: string; role: string }>; requireMfaClaim: boolean;
  }): Promise<ApiResult<{ id: string; protocol: string; status: string }>> {
    return this.post("/api/desktop/identity-providers", input);
  }

  revokeIdentityProvider(id: string): Promise<ApiResult<{ id: string; status: string }>> {
    return this.post(`/api/desktop/identity-providers/${encodeURIComponent(id)}/revoke`, {});
  }

  previewScimLifecycle(input: { employees: unknown; currentGrants: unknown }): Promise<ApiResult<{
    actions: Array<{ kind: string; userId: string; role: string; reason: string }>;
    joinersCount: number; moversCount: number; leaversCount: number;
  }>> {
    return this.post("/api/desktop/identity-providers/scim-preview", input);
  }

  aiProviderStatus(): Promise<ApiResult<{
    policy: ModelPolicy;
    providers: Array<{ provider: string; models: Array<{ id: string; label: string; tier: string }> }>;
  }>> {
    return this.get("/api/desktop/ai-providers");
  }

  updateAiProviderPolicy(policy: ModelPolicy): Promise<ApiResult<{ policy: typeof policy }>> {
    return this.put("/api/desktop/ai-providers", policy);
  }

  integrationHealth(): Promise<ApiResult<{
    status: "healthy" | "degraded" | "preview" | "blocked" | "disabled" | "unknown";
    sourceMode: string;
    summary: { total: number; healthy: number; degraded: number; preview: number; blocked: number; disabled: number };
  }>> {
    return this.get("/api/desktop/integration-health");
  }

  deploymentRequests(): Promise<ApiResult<Array<{
    id: string;
    title: string;
    status: string;
    version: number;
    correlationId: string;
    submittedAt: string | null;
    closedAt: string | null;
    updatedAt: string;
    releaseContext: {
      window: { startUtc: string; endUtc: string; displayTimeZone: string } | null;
      scope: { applicationCount: number; repositoryCount: number; targetEnvironment: string | null };
      approval: { prStatus: string; noPrRequired: boolean };
      readiness: {
        developmentReady: boolean;
        productionReady: boolean;
        validationStepCount: number;
        deferredValidation: boolean;
        approvalDecision: "ready_for_human_approval" | "needs_attention";
        blockers: string[];
      };
      recovery: { rollbackAvailability: string; backupRequired: boolean; evidenceCount: number };
      observation: { status: "not_connected"; recordedMonitoringPlan: boolean };
      batches?: { selectedRunCount: number };
    };
    latestPlaybook: {
      id: string;
      version: number;
      status: string;
      contentHash: string;
      createdAt: string;
    } | null;
  }>>> {
    return this.get("/api/desktop/deployments");
  }

  createReleaseResolutionDraft(draft: Record<string, unknown>, idempotencyId: string): Promise<ApiResult<{
    id: string; title: string; status: string; version: number; correlationId: string; submittedAt: null; replayed: boolean;
  }>> {
    return this.post("/api/desktop/deployments/drafts", draft, { "x-correlation-id": idempotencyId });
  }

  createDeploymentRequest(
    intake: Record<string, unknown>,
    idempotencyId: string,
  ): Promise<ApiResult<{
    id: string;
    title: string;
    status: string;
    version: number;
    correlationId: string;
    submittedAt: string | null;
    replayed: boolean;
  }>> {
    return this.post(
      "/api/desktop/deployments",
      intake,
      { "x-correlation-id": idempotencyId },
    );
  }

  serviceNowTicketRecovery(requestId:string,actionId:string,input:{expectedVersion:number;clientRequestId:string;issue?:{sysId:string;number:string}},mode:'propose'|'approve'|'verify'|'cancel',signal?:AbortSignal):Promise<ReleasePlanResult<ServiceNowTicketLifecycleState>>{
    return releaseOperationPlanRequest(this.savedTaskContext(),'POST',`/api/desktop/deployments/${requestId}/servicenow-actions/${actionId}/recovery${mode==='propose'?'':mode==='approve'?'/approval':'/'+mode}`,input,(v):v is ServiceNowTicketLifecycleState=>isServiceNowTicketLifecycleState(v,requestId)&&v.actions.length===1&&v.actions[0].id===actionId&&v.actions[0].status==='unknown'&&v.actions[0].version>input.expectedVersion&&v.actions[0].recovery?.status===(mode==='propose'?'requested':mode==='approve'?'approved':mode==='verify'?'verified':'cancelled'),signal);
  }
  serviceNowTicketActions(requestId:string,signal?:AbortSignal):Promise<ReleasePlanResult<ServiceNowTicketLifecycleState>> {
    return releaseOperationPlanRequest(this.savedTaskContext(),'GET',`/api/desktop/deployments/${requestId}/servicenow-actions`,undefined,(v):v is ServiceNowTicketLifecycleState=>isServiceNowTicketLifecycleState(v,requestId),signal);
  }
  serviceNowTicketMetadata(requestId:string,signal?:AbortSignal):Promise<ReleasePlanResult<ServiceNowMetadata>> {
    return releaseOperationPlanRequest(this.savedTaskContext(),'GET',`/api/desktop/deployments/${requestId}/servicenow-actions/metadata`,undefined,(v):v is ServiceNowMetadata=>isServiceNowMetadata(v,requestId),signal);
  }
  saveServiceNowTicketAction(requestId:string,input:{processId:string;values:{shortDescription:string;description?:string};clientRequestId:string},signal?:AbortSignal,amendment?:{actionId:string;expectedVersion:number}):Promise<ReleasePlanResult<ServiceNowTicketLifecycleState>> {
    return releaseOperationPlanRequest(this.savedTaskContext(),amendment?'PATCH':'POST',`/api/desktop/deployments/${requestId}/servicenow-actions${amendment?'/'+amendment.actionId:''}`,{...input,...(amendment?{expectedVersion:amendment.expectedVersion}:{})},(v):v is ServiceNowTicketLifecycleState=>isServiceNowTicketLifecycleState(v,requestId)&&v.actions.length===1&&v.actions[0].kind==='publish'&&v.actions[0].status==='awaiting_approval'&&(!amendment||v.actions[0].id===amendment.actionId&&v.actions[0].version>amendment.expectedVersion),signal);
  }
  mutateServiceNowTicketAction(requestId:string,actionId:string,input:{expectedVersion:number;clientRequestId:string},mode:'approve'|'cancel'|'dispatch'|'recover',signal?:AbortSignal):Promise<ReleasePlanResult<ServiceNowTicketLifecycleState>> {
    return releaseOperationPlanRequest(this.savedTaskContext(),mode==='cancel'?'DELETE':'POST',`/api/desktop/deployments/${requestId}/servicenow-actions/${actionId}${mode==='cancel'?'':mode==='approve'?'/approval':'/'+mode}`,input,(v):v is ServiceNowTicketLifecycleState=>isServiceNowTicketLifecycleState(v,requestId)&&v.actions.length===1&&v.actions[0].id===actionId&&(mode==='approve'?v.actions[0].status==='approved':mode==='cancel'?v.actions[0].status==='cancelled':['confirmed','refused','unknown','dispatching'].includes(v.actions[0].status))&&(mode==='recover'?v.actions[0].version>=input.expectedVersion:v.actions[0].version>input.expectedVersion),signal);
  }
  serviceNowTicketCloseOptions(requestId:string,publishActionId:string,signal?:AbortSignal):Promise<ReleasePlanResult<ServiceNowCloseOptions>> {
    return releaseOperationPlanRequest(this.savedTaskContext(),'GET',`/api/desktop/deployments/${requestId}/servicenow-actions/${publishActionId}/close-options`,undefined,(v):v is ServiceNowCloseOptions=>isServiceNowCloseOptions(v,requestId,publishActionId),signal);
  }
  refreshServiceNowTicketCloseOptions(requestId:string,actionId:string,expectedVersion:number,signal?:AbortSignal):Promise<ReleasePlanResult<ServiceNowCloseOptions>> {
    return releaseOperationPlanRequest(this.savedTaskContext(),'GET',`/api/desktop/deployments/${requestId}/servicenow-actions/${actionId}/close-options`,undefined,(v):v is ServiceNowCloseOptions=>isServiceNowCloseOptions(v,requestId,actionId,expectedVersion),signal);
  }
  prepareServiceNowTicketClose(requestId:string,publishActionId:string,input:{transitionId:string;closeCode?:string;closeNotes?:string;clientRequestId:string;expectedVersion?:number},signal?:AbortSignal):Promise<ReleasePlanResult<ServiceNowTicketLifecycleState>> {
    return releaseOperationPlanRequest(this.savedTaskContext(),'POST',`/api/desktop/deployments/${requestId}/servicenow-actions/${publishActionId}/close-options`,input,(v):v is ServiceNowTicketLifecycleState=>isServiceNowTicketLifecycleState(v,requestId)&&v.actions.length===1&&v.actions[0].kind==='close'&&v.actions[0].status==='awaiting_approval'&&(input.expectedVersion===undefined||v.actions[0].id===publishActionId&&v.actions[0].version>input.expectedVersion),signal);
  }
  jiraTicketCloseOptions(requestId:string,publishActionId:string,signal?:AbortSignal):Promise<ReleasePlanResult<JiraCloseOptions>> {
    if(!/^[A-Za-z0-9_-]{1,160}$/.test(requestId)||!/^jira_action_[a-f0-9]{64}$/.test(publishActionId))return Promise.resolve({ok:false,error:'Reload saved Jira actions.',outcomeUnconfirmed:false});
    return releaseOperationPlanRequest(this.savedTaskContext(),'GET',`/api/desktop/deployments/${requestId}/jira-actions/${publishActionId}/close-options`,undefined,(v):v is JiraCloseOptions=>isJiraCloseOptions(v,requestId,publishActionId),signal);
  }
  refreshJiraTicketCloseOptions(requestId:string,actionId:string,expectedVersion:number,signal?:AbortSignal):Promise<ReleasePlanResult<JiraCloseOptions>> {
    if(!/^[A-Za-z0-9_-]{1,160}$/.test(requestId)||!/^jira_action_[a-f0-9]{64}$/.test(actionId)||!Number.isInteger(expectedVersion)||expectedVersion<0)return Promise.resolve({ok:false,error:'Reload saved Jira actions.',outcomeUnconfirmed:false});
    return releaseOperationPlanRequest(this.savedTaskContext(),'GET',`/api/desktop/deployments/${requestId}/jira-actions/${actionId}/close-options`,undefined,(v):v is JiraCloseOptions=>isJiraCloseOptions(v,requestId,actionId,expectedVersion),signal);
  }
  prepareJiraTicketClose(requestId:string,publishActionId:string,input:{transitionId:string;clientRequestId:string;expectedVersion?:number},signal?:AbortSignal):Promise<ReleasePlanResult<JiraTicketLifecycleState>> {
    if(!/^[A-Za-z0-9_-]{1,160}$/.test(requestId)||!/^jira_action_[a-f0-9]{64}$/.test(publishActionId)||!/^[0-9]{1,20}$/.test(input.transitionId)||!validOperationUuid(input.clientRequestId)||(input.expectedVersion!==undefined&&(!Number.isInteger(input.expectedVersion)||input.expectedVersion<0))||Object.keys(input).some(k=>!['transitionId','clientRequestId','expectedVersion'].includes(k)))return Promise.resolve({ok:false,error:'Reload saved Jira actions.',outcomeUnconfirmed:false});
    return releaseOperationPlanRequest(this.savedTaskContext(),'POST',`/api/desktop/deployments/${requestId}/jira-actions/${publishActionId}/close-options`,input,(v):v is JiraTicketLifecycleState=>isJiraTicketLifecycleState(v,requestId)&&v.actions.length===1&&v.actions[0].kind==='close'&&v.actions[0].status==='awaiting_approval'&&(input.expectedVersion===undefined||v.actions[0].id===publishActionId&&v.actions[0].version>input.expectedVersion),signal);
  }
  recoverServiceNowTerminalPolicy(clientRequestId:string,signal?:AbortSignal):Promise<ReleasePlanResult<TicketGovernanceReview>> {
    if(!ticketReviewNonce.safeParse(clientRequestId).success)return Promise.resolve({ok:false,error:'Use the original unconfirmed policy request ID.',outcomeUnconfirmed:false});
    return releaseOperationPlanRequest(this.savedTaskContext(),'POST','/api/desktop/ticket-governance/lookup',{clientRequestId},(v):v is TicketGovernanceReview=>isTicketGovernanceReview(v)&&v.binding.kind==='servicenow_terminal_policy',signal);
  }
  serviceNowTerminalPolicyOptions(signal?:AbortSignal):Promise<ReleasePlanResult<ServiceNowTerminalPolicyOptions>> {
    return releaseOperationPlanRequest(this.savedTaskContext(),'GET','/api/desktop/ticket-governance/servicenow-policy-options',undefined,(v):v is ServiceNowTerminalPolicyOptions=>serviceNowTerminalPolicyOptionsSchema.safeParse(v).success,signal);
  }
  prepareServiceNowTerminalPolicy(input:ServiceNowTerminalPolicyRequest,clientRequestId:string,signal?:AbortSignal):Promise<ReleasePlanResult<TicketGovernanceReview>> {
    const parsed=serviceNowTerminalPolicyRequestSchema.safeParse(input);if(!parsed.success||!ticketReviewNonce.safeParse(clientRequestId).success)return Promise.resolve({ok:false,error:'Review the administrator-declared policy fields and source evidence.',outcomeUnconfirmed:false});
    const selected=parsed.data;return releaseOperationPlanRequest(this.savedTaskContext(),'POST','/api/desktop/ticket-governance',{binding:selected,clientRequestId},(v):v is TicketGovernanceReview=>isTicketGovernanceReview(v)&&v.binding.kind==='servicenow_terminal_policy'&&v.binding.nativeProcess.kind==='model'&&v.binding.nativeProcess.modelSysId===selected.modelSysId&&JSON.stringify(v.binding.sourceReferences)===JSON.stringify(selected.sourceReferences)&&JSON.stringify(v.binding.terminalStates)===JSON.stringify(selected.terminalStates)&&JSON.stringify(v.binding.fields)===JSON.stringify(selected.fields),signal);
  }
  platformSourceClient(){return createPlatformSourceClient(this.savedTaskContext())}
  platformHistoryClient(){return createPlatformHistoryClient(this.savedTaskContext())}
  platformPreparationClient(){return createPlatformPreparationClient(this.savedTaskContext())}
  platformExecutionClient(){return createPlatformExecutionClient(this.savedTaskContext())}
  platformReviewClient(){return createPlatformReviewClient(this.savedTaskContext())}
  governanceCollectionSources(signal?:AbortSignal):Promise<ReleasePlanResult<GovernanceSourceDirectory>> {
    return releaseOperationPlanRequest(this.savedTaskContext(),'POST','/api/desktop/governance-intelligence/read',{operation:'list_collection_sources'},(v):v is GovernanceSourceDirectory=>governanceSourceDirectorySchema.safeParse(v).success,signal);
  }
  governanceCollect(raw:unknown,requestId:string,signal?:AbortSignal):Promise<ReleasePlanResult<GovernanceEvidenceArtifact>> {
    const parsed=governanceCollectionSchema.safeParse(raw);if(!parsed.success||!ticketReviewNonce.safeParse(requestId).success)return Promise.resolve({ok:false,error:'Select an exact existing connection, scope and supported read profile.',outcomeUnconfirmed:false});
    const selected=parsed.data;return releaseOperationPlanRequest(this.savedTaskContext(),'POST','/api/desktop/governance-intelligence/collect',{operation:'collect',selection:selected,requestId},(v):v is GovernanceEvidenceArtifact=>{const checked=governanceEvidenceArtifactSchema.safeParse(v);if(!checked.success)return false;const e=checked.data.snapshot;return e.source===selected.source&&e.connectionId===selected.connectionId&&e.connectionRevision===selected.connectionRevision&&e.collectorVersion==='governance-discovery-read-v1'&&JSON.stringify(e.selection)===JSON.stringify(selected.selection)&&JSON.stringify(e.collectionOperations)===JSON.stringify(selected.operations)},signal);
  }
  governanceLookupCollection(raw:unknown,requestId:string,signal?:AbortSignal):Promise<ReleasePlanResult<GovernanceDocumentLookup>> {
    const parsed=governanceCollectionSchema.safeParse(raw);if(!parsed.success||!ticketReviewNonce.safeParse(requestId).success)return Promise.resolve({ok:false,error:'Keep the exact original collection request for read-only recovery.',outcomeUnconfirmed:false});
    const selected=parsed.data;return releaseOperationPlanRequest(this.savedTaskContext(),'POST','/api/desktop/governance-intelligence/read',{operation:'lookup_collection',requestId},(v):v is GovernanceDocumentLookup=>{const checked=governanceDocumentLookupSchema.safeParse(v);if(!checked.success)return false;if(!checked.data.found)return true;const e=checked.data.artifact.snapshot;return e.source===selected.source&&e.connectionId===selected.connectionId&&e.connectionRevision===selected.connectionRevision&&e.collectorVersion==='governance-discovery-read-v1'&&JSON.stringify(e.selection)===JSON.stringify(selected.selection)&&JSON.stringify(e.collectionOperations)===JSON.stringify(selected.operations)},signal);
  }
  governanceDocumentHead(raw:unknown,signal?:AbortSignal):Promise<ReleasePlanResult<GovernanceDocumentHead>> {
    const parsed=governanceEvidenceArtifactSchema.safeParse(raw);
    const fail=()=>Promise.resolve<ReleasePlanResult<GovernanceDocumentHead>>({ok:false,error:'Verify the saved policy source before loading its current version.',outcomeUnconfirmed:false});
    if(!parsed.success||signal?.aborted)return fail();
    const a=parsed.data,s=a.snapshot;
    if(s.source!=='document'||s.collectorVersion!=='governance-document-v2'||s.connectionRevision!==s.sourceDigest||!s.connectionId.startsWith('upload:')||!governanceDocumentUploadSchema.shape.name.safeParse(s.connectionId.slice(7)).success)return fail();
    return releaseOperationPlanRequest(this.savedTaskContext(),'POST','/api/desktop/governance-intelligence/read',{operation:'read_document_head',artifactDigest:s.digest},(v):v is GovernanceDocumentHead=>{const checked=governanceDocumentHeadSchema.safeParse(v);if(!checked.success)return false;const h=checked.data;return h.artifactId===a.id&&h.artifactDigest===s.digest&&h.organizationId===s.organizationId&&h.name===s.connectionId.slice(7)&&h.selectedSourceDigest===s.sourceDigest&&JSON.stringify(h.selection)===JSON.stringify(s.selection)},signal);
  }
  async governanceLookupDocument(raw:unknown,signal?:AbortSignal):Promise<ReleasePlanResult<GovernanceDocumentLookup>> {
    const parsed=governanceDocumentUploadSchema.safeParse(raw),owner=this.config,revision=this.getContextRevision();
    const fail=():ReleasePlanResult<GovernanceDocumentLookup>=>({ok:false,error:'Verify the original selected document and workspace before checking its saved record.',outcomeUnconfirmed:false});
    if(!parsed.success||signal?.aborted||!globalThis.crypto?.subtle)return fail();
    try{const selected=parsed.data,bytes=new Uint8Array(selected.utf8Bytes);decodePolicyUploadBytes(bytes);const hashed=await crypto.subtle.digest('SHA-256',bytes),sourceDigest=Array.from(new Uint8Array(hashed),b=>b.toString(16).padStart(2,'0')).join('');
      if(owner!==this.config||revision!==this.getContextRevision()||signal?.aborted)return fail();
      return releaseOperationPlanRequest(this.savedTaskContext(),'POST','/api/desktop/governance-intelligence/read',{operation:'lookup_document_upload',requestId:selected.requestId},(v):v is GovernanceDocumentLookup=>{const checked=governanceDocumentLookupSchema.safeParse(v);if(!checked.success)return false;if(!checked.data.found)return true;const s=checked.data.artifact.snapshot;return s.source==='document'&&s.connectionId==='upload:'+selected.name&&s.sourceDigest===sourceDigest&&s.connectionRevision===sourceDigest&&s.collectorVersion==='governance-document-v2'&&JSON.stringify(s.selection)===JSON.stringify(selected.selection)},signal);
    }catch{return fail()}
  }
  async governanceUploadDocument(raw:unknown,signal?:AbortSignal):Promise<ReleasePlanResult<GovernanceDocumentReceipt>> {
    const parsed=governanceDocumentUploadSchema.safeParse(raw),owner=this.config,revision=this.getContextRevision();
    const fail=():ReleasePlanResult<GovernanceDocumentReceipt>=>({ok:false,error:'Verify the selected text document and workspace before saving.',outcomeUnconfirmed:false});
    if(!parsed.success||signal?.aborted||!globalThis.crypto?.subtle)return fail();
    try{const selected=parsed.data,bytes=new Uint8Array(selected.utf8Bytes);decodePolicyUploadBytes(bytes);const hashed=await crypto.subtle.digest('SHA-256',bytes),sourceDigest=Array.from(new Uint8Array(hashed),b=>b.toString(16).padStart(2,'0')).join('');
      if(owner!==this.config||revision!==this.getContextRevision()||signal?.aborted)return fail();
      let binary='';for(let i=0;i<bytes.length;i+=4096)binary+=String.fromCharCode(...bytes.subarray(i,i+4096));
      return releaseOperationPlanRequest(this.savedTaskContext(),'POST','/api/desktop/governance-intelligence/documents',{operation:'upload_document',name:selected.name,selection:selected.selection,base64:btoa(binary),expectedVersion:selected.expectedVersion,requestId:selected.requestId},(v):v is GovernanceDocumentReceipt=>{const checked=governanceDocumentReceiptSchema.safeParse(v);return checked.success&&checked.data.name===selected.name&&checked.data.sourceDigest===sourceDigest&&JSON.stringify(checked.data.selection)===JSON.stringify(selected.selection)&&checked.data.headVersion===(selected.expectedVersion===null?0:selected.expectedVersion+1)},signal);
    }catch{return fail()}
  }
  governanceExecutionPolicies(){return createExecutionPolicyClient(this.savedTaskContext())}
  governancePropose(raw:unknown,requestId:string,signal?:AbortSignal):Promise<ReleasePlanResult<GovernanceRevision>> {
    const parsed=governanceProposalSchema.safeParse(raw);if(!parsed.success||!ticketReviewNonce.safeParse(requestId).success)return Promise.resolve({ok:false,error:'Review exact source, scope and rules before saving a proposal.',outcomeUnconfirmed:false});
    const selected=parsed.data;
    return releaseOperationPlanRequest(this.savedTaskContext(),'POST','/api/desktop/governance-intelligence/review',{operation:'propose',baseline:selected,requestId},(v):v is GovernanceRevision=>{const checked=governanceRevisionSchema.safeParse(v);if(!checked.success)return false;const b=checked.data.baseline;return b.parentDigest===selected.parentDigest&&JSON.stringify(b.scopes)===JSON.stringify(selected.scopes)&&JSON.stringify(b.rules)===JSON.stringify(selected.rules)&&JSON.stringify(b.evidenceDigests)===JSON.stringify(selected.evidenceDigests)},signal);
  }
  governanceApprove(id:string,version:number,digest:string,requestId:string,signal?:AbortSignal):Promise<ReleasePlanResult<GovernanceRevision>> {
    if(!governanceRevisionId.safeParse(id).success||version!==0||! /^[a-f0-9]{64}$/.test(digest)||!ticketReviewNonce.safeParse(requestId).success)return Promise.resolve({ok:false,error:'Reload the exact proposed baseline before reviewing.',outcomeUnconfirmed:false});
    return releaseOperationPlanRequest(this.savedTaskContext(),'POST','/api/desktop/governance-intelligence/review',{operation:'approve',id,version,digest,requestId},(v):v is GovernanceRevision=>governanceRevisionSchema.safeParse(v).success&&(v as GovernanceRevision).id===id&&(v as GovernanceRevision).baseline.digest===digest&&(v as GovernanceRevision).status==='approved'&&(v as GovernanceRevision).version===1,signal);
  }
  governanceRevoke(id:string,version:number,requestId:string,signal?:AbortSignal):Promise<ReleasePlanResult<GovernanceRevision>> {
    if(!governanceRevisionId.safeParse(id).success||![0,1].includes(version)||!ticketReviewNonce.safeParse(requestId).success)return Promise.resolve({ok:false,error:'Reload the exact baseline revision before revoking.',outcomeUnconfirmed:false});
    return releaseOperationPlanRequest(this.savedTaskContext(),'POST','/api/desktop/governance-intelligence/review',{operation:'revoke',id,version,requestId},(v):v is GovernanceRevision=>governanceRevisionSchema.safeParse(v).success&&(v as GovernanceRevision).id===id&&(v as GovernanceRevision).status==='revoked'&&(v as GovernanceRevision).version===version+1,signal);
  }
  governanceRevisions(signal?:AbortSignal):Promise<ReleasePlanResult<GovernanceRevisionList>> {
    return releaseOperationPlanRequest(this.savedTaskContext(),'POST','/api/desktop/governance-intelligence/read',{operation:'list_revisions'},(v):v is GovernanceRevisionList=>governanceRevisionListSchema.safeParse(v).success,signal);
  }
  governanceEvidenceArtifact(digest:string,signal?:AbortSignal):Promise<ReleasePlanResult<GovernanceEvidenceArtifact>> {
    if(! /^[a-f0-9]{64}$/.test(digest))return Promise.resolve({ok:false,error:'Select exact recorded source evidence.',outcomeUnconfirmed:false});
    return releaseOperationPlanRequest(this.savedTaskContext(),'POST','/api/desktop/governance-intelligence/read',{operation:'read_evidence',digest},(v):v is GovernanceEvidenceArtifact=>governanceEvidenceArtifactSchema.safeParse(v).success&&(v as GovernanceEvidenceArtifact).snapshot.digest===digest,signal);
  }
  governanceEvidence(signal?:AbortSignal):Promise<ReleasePlanResult<GovernanceEvidenceList>> {
    return releaseOperationPlanRequest(this.savedTaskContext(),'POST','/api/desktop/governance-intelligence/read',{operation:'list_evidence'},(v):v is GovernanceEvidenceList=>governanceEvidenceListSchema.safeParse(v).success,signal);
  }
  governanceRevision(id:string,signal?:AbortSignal):Promise<ReleasePlanResult<GovernanceRevision>> {
    if(!governanceRevisionId.safeParse(id).success)return Promise.resolve({ok:false,error:'Select an exact saved baseline revision.',outcomeUnconfirmed:false});
    return releaseOperationPlanRequest(this.savedTaskContext(),'POST','/api/desktop/governance-intelligence/read',{operation:'read_revision',id},(v):v is GovernanceRevision=>governanceRevisionSchema.safeParse(v).success&&(v as GovernanceRevision).id===id,signal);
  }
  governanceDrift(id:string,baselineDigest:string,signal?:AbortSignal):Promise<ReleasePlanResult<GovernanceDrift>> {
    if(!governanceRevisionId.safeParse(id).success||! /^[a-f0-9]{64}$/.test(baselineDigest))return Promise.resolve({ok:false,error:'Reload the exact saved baseline before checking sources.',outcomeUnconfirmed:false});
    return releaseOperationPlanRequest(this.savedTaskContext(),'POST','/api/desktop/governance-intelligence/read',{operation:'read_drift',id},(v):v is GovernanceDrift=>governanceDriftSchema.safeParse(v).success&&(v as GovernanceDrift).baselineDigest===baselineDigest,signal);
  }
  associatedTicketAction(reviewId:string,input:AssociatedTicketActionsRequest,signal?:AbortSignal):Promise<ReleasePlanResult<AssociatedTicketActionsResult>> {
    if(!ticketReviewId.safeParse(reviewId).success||!associatedTicketActionsRequestSchema.safeParse(input).success)return Promise.resolve({ok:false,error:'Reload the exact ticket association and saved actions.',outcomeUnconfirmed:false});
    return releaseOperationPlanRequest(this.savedTaskContext(),'POST',`/api/desktop/ticket-governance/${reviewId}/actions`,input,(v):v is AssociatedTicketActionsResult=>isAssociatedTicketActionsResult(v,reviewId,input),signal);
  }
  prepareServiceNowWrittenObservation(input:ServiceNowWrittenObservationRequest,clientRequestId:string,signal?:AbortSignal):Promise<ReleasePlanResult<TicketGovernanceReview>> {
    const parsed=serviceNowWrittenObservationRequestSchema.safeParse(input);if(!parsed.success||!ticketReviewNonce.safeParse(clientRequestId).success)return Promise.resolve({ok:false,error:'Reload the exact unknown note and its current association.',outcomeUnconfirmed:false});
    const selected=parsed.data;return releaseOperationPlanRequest(this.savedTaskContext(),'POST','/api/desktop/ticket-governance',{binding:selected,clientRequestId},(v):v is TicketGovernanceReview=>isTicketGovernanceReview(v)&&v.binding.kind==='servicenow_written_link_observation_v1'&&v.binding.originalActionId===selected.actionId&&v.binding.originalVersion===selected.expectedVersion&&v.binding.association.reviewId===selected.association.reviewId&&v.binding.association.bindingDigest===selected.association.bindingDigest,signal);
  }
  lookupServiceNowWrittenObservation(clientRequestId:string,input:ServiceNowWrittenObservationRequest,signal?:AbortSignal):Promise<ReleasePlanResult<TicketGovernanceReview>> {
    const parsed=serviceNowWrittenObservationRequestSchema.safeParse(input);if(!parsed.success||!ticketReviewNonce.safeParse(clientRequestId).success)return Promise.resolve({ok:false,error:'Use the saved observation request ID.',outcomeUnconfirmed:false});
    const selected=parsed.data;return releaseOperationPlanRequest(this.savedTaskContext(),'POST','/api/desktop/ticket-governance/lookup',{clientRequestId},(v):v is TicketGovernanceReview=>isTicketGovernanceReview(v)&&v.binding.kind==='servicenow_written_link_observation_v1'&&v.binding.originalActionId===selected.actionId&&v.binding.originalVersion===selected.expectedVersion&&v.binding.association.reviewId===selected.association.reviewId&&v.binding.association.bindingDigest===selected.association.bindingDigest,signal);
  }
  prepareTicketAssociation(input:TicketAssociationSelection,clientRequestId:string,signal?:AbortSignal):Promise<ReleasePlanResult<TicketGovernanceReview>> {
    if(!ticketAssociationSelectionSchema.safeParse(input).success||!ticketReviewNonce.safeParse(clientRequestId).success)return Promise.resolve({ok:false,error:'Choose an existing ticket and saved deployment evidence.',outcomeUnconfirmed:false});
    return releaseOperationPlanRequest(this.savedTaskContext(),'POST','/api/desktop/ticket-governance',{binding:input,clientRequestId},(v):v is TicketGovernanceReview=>isTicketGovernanceReview(v)&&v.binding.kind==='ticket_release_association'&&v.binding.original.actionId===input.originalActionId&&v.binding.ticket.provider===input.provider&&v.binding.deployment.evidenceId===input.evidenceId&&v.binding.deployment.headReleaseVersion===input.expectedHeadVersion,signal);
  }
  ticketGovernanceReview(id:string,signal?:AbortSignal):Promise<ReleasePlanResult<TicketGovernanceReview>> {
    if(!ticketReviewId.safeParse(id).success)return Promise.resolve({ok:false,error:'Enter the saved ticket review ID.',outcomeUnconfirmed:false});
    return releaseOperationPlanRequest(this.savedTaskContext(),'GET',`/api/desktop/ticket-governance/${id}`,undefined,(v):v is TicketGovernanceReview=>isTicketGovernanceReview(v)&&v.id===id,signal);
  }
  mutateTicketGovernanceReview(id:string,expectedVersion:number,clientRequestId:string,mode:'approve'|'cancel',signal?:AbortSignal):Promise<ReleasePlanResult<TicketGovernanceReview>> {
    if(!ticketReviewId.safeParse(id).success||!Number.isInteger(expectedVersion)||expectedVersion<0||expectedVersion>1||!ticketReviewNonce.safeParse(clientRequestId).success||!['approve','cancel'].includes(mode))return Promise.resolve({ok:false,error:'Reload the exact saved ticket review.',outcomeUnconfirmed:false});
    return releaseOperationPlanRequest(this.savedTaskContext(),'POST',`/api/desktop/ticket-governance/${id}/${mode==='approve'?'approval':'cancel'}`,{expectedVersion,clientRequestId},(v):v is TicketGovernanceReview=>isTicketGovernanceReview(v)&&v.id===id&&v.version===expectedVersion+1&&(mode==='approve'?v.status==='approved':['cancelled','revoked'].includes(v.status)),signal);
  }
  jiraTicketActions(requestId:string,signal?:AbortSignal):Promise<ReleasePlanResult<JiraTicketLifecycleState>> {
    if(!/^[A-Za-z0-9_-]{1,160}$/.test(requestId))return Promise.resolve({ok:false,error:'Reload saved Jira actions.',outcomeUnconfirmed:false});
    return releaseOperationPlanRequest(this.savedTaskContext(),'GET',`/api/desktop/deployments/${requestId}/jira-actions`,undefined,(v):v is JiraTicketLifecycleState=>isJiraTicketLifecycleState(v,requestId),signal);
  }
  saveJiraTicketAction(requestId:string,input:JiraCreatePreviewInput,payloadDigest:string,clientRequestId:string,signal?:AbortSignal,amendment?:{actionId:string;expectedVersion:number}):Promise<ReleasePlanResult<JiraTicketLifecycleState>> {
    if(!/^[A-Za-z0-9_-]{1,160}$/.test(requestId)||!/^[a-f0-9]{64}$/.test(payloadDigest)||!validOperationUuid(clientRequestId)||amendment&&(!/^jira_action_[a-f0-9]{64}$/.test(amendment.actionId)||!validOperationVersion(amendment.expectedVersion)))return Promise.resolve({ok:false,error:'Reload saved Jira actions.',outcomeUnconfirmed:false});
    return releaseOperationPlanRequest(this.savedTaskContext(),amendment?'PATCH':'POST',`/api/desktop/deployments/${requestId}/jira-actions${amendment?'/'+amendment.actionId:''}`,input,(v):v is JiraTicketLifecycleState=>isJiraTicketLifecycleState(v,requestId)&&v.actions.length===1&&v.actions[0].kind==='publish'&&v.actions[0].payloadDigest===payloadDigest&&(!amendment||v.actions[0].id===amendment.actionId&&v.actions[0].version>amendment.expectedVersion),signal,clientRequestId,amendment?.expectedVersion);
  }
  mutateJiraTicketAction(requestId:string,actionId:string,input:{expectedVersion:number;clientRequestId:string},approve:boolean|'dispatch'|'recover',signal?:AbortSignal):Promise<ReleasePlanResult<JiraTicketLifecycleState>> {
    if(!/^[A-Za-z0-9_-]{1,160}$/.test(requestId)||!/^jira_action_[a-f0-9]{64}$/.test(actionId)||!validOperationVersion(input.expectedVersion)||!validOperationUuid(input.clientRequestId)||Object.keys(input).some(k=>!['expectedVersion','clientRequestId'].includes(k)))return Promise.resolve({ok:false,error:'Reload saved Jira actions.',outcomeUnconfirmed:false});
    return releaseOperationPlanRequest(this.savedTaskContext(),approve?'POST':'DELETE',`/api/desktop/deployments/${requestId}/jira-actions/${actionId}${approve==='dispatch'?'/dispatch':approve==='recover'?'/recover':approve?'/approval':''}`,input,(v):v is JiraTicketLifecycleState=>isJiraTicketLifecycleState(v,requestId)&&v.actions.length===1&&v.actions[0].id===actionId&&(approve==='dispatch'||approve==='recover'?['confirmed','refused','unknown','dispatching'].includes(v.actions[0].status):v.actions[0].status===(approve?'approved':'cancelled'))&&(approve==='recover'?v.actions[0].version>=input.expectedVersion:v.actions[0].version>input.expectedVersion),signal);
  }
  releaseWorkflowEvidence(requestId:string,planId:string,digest:string,signal?:AbortSignal):Promise<ReleasePlanResult<ReleaseWorkflowEvidenceResponse>> {
    return this.releaseWorkflowEvidenceRequest(requestId,planId,digest,undefined,signal);
  }
  collectReleaseWorkflowEvidence(requestId:string,planId:string,digest:string,signal?:AbortSignal):Promise<ReleasePlanResult<ReleaseWorkflowEvidenceResponse>> {
    return this.releaseWorkflowEvidenceRequest(requestId,planId,digest,{action:'collect'},signal);
  }
  mutateReleaseWorkflowEvidence(requestId:string,planId:string,digest:string,input:{action:'cancel'|'reconcile';id:string;expectedVersion:number},signal?:AbortSignal):Promise<ReleasePlanResult<ReleaseWorkflowEvidenceResponse>> {
    if(!['cancel','reconcile'].includes(input.action)||!/^release_workflow_evidence_[a-f0-9]{64}$/.test(input.id)||!Number.isInteger(input.expectedVersion)||input.expectedVersion<0||input.expectedVersion>7||Object.keys(input).some(k=>!['action','id','expectedVersion'].includes(k)))return Promise.resolve({ok:false,error:'Reload release workflow evidence.',outcomeUnconfirmed:false});
    return this.releaseWorkflowEvidenceRequest(requestId,planId,digest,input,signal);
  }
  private releaseWorkflowEvidenceRequest(requestId:string,planId:string,digest:string,body:unknown,signal?:AbortSignal):Promise<ReleasePlanResult<ReleaseWorkflowEvidenceResponse>> {
    if(!/^[A-Za-z0-9_-]{1,160}$/.test(requestId)||!/^release_plan_[a-f0-9]{64}$/.test(planId)||!/^[a-f0-9]{64}$/.test(digest))return Promise.resolve({ok:false,error:'Reload release workflow evidence.',outcomeUnconfirmed:false});
    return releaseOperationPlanRequest(this.savedTaskContext(),body?'POST':'GET',`/api/desktop/deployments/${requestId}/operation-plans/${planId}/workflow-evidence`,body,(v):v is ReleaseWorkflowEvidenceResponse=>isReleaseWorkflowEvidenceResponse(v,requestId,planId,digest)&&(!body||v.evidence.length===1&&((body as {action:string}).action==='collect'?v.evidence[0].state!=='cancelled':v.evidence[0].id===(body as {id:string}).id&&((body as {action:string}).action==='cancel'?v.evidence[0].state==='cancelled':['observed','unknown'].includes(v.evidence[0].state))&&v.evidence[0].version>(body as {expectedVersion:number}).expectedVersion)),signal);
  }
  async deploymentApprovalPreview(requestId:string,planId:string,signal?:AbortSignal):Promise<ReleasePlanResult<ReleaseDeploymentApprovalPreview>> {
    const revision=this.getContextRevision(),config=this.config;
    const fail={ok:false as const,error:'Reload the release before reviewing deployment.',outcomeUnconfirmed:false};
    if(!/^[A-Za-z0-9_-]{1,160}$/.test(requestId)||!/^release_plan_[a-f0-9]{64}$/.test(planId))return fail;
    const result=await releaseOperationPlanRequest(this.savedTaskContext(),'GET',`/api/desktop/deployments/${requestId}/operation-plans/${planId}/deployment-approval`,undefined,(value):value is ReleaseDeploymentApprovalPreview=>{
      const parsed=releaseDeploymentApprovalPreviewSchema.safeParse(value);
      return parsed.success&&parsed.data.plan.releaseId===requestId&&parsed.data.plan.planId===planId;
    },signal);
    if(!result.ok)return result;
    const normalize=(v:unknown):unknown=>Array.isArray(v)?v.map(normalize):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,value])=>[k,normalize(value)])):v;
    try{
      const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(normalize(result.data.plan))))),b=>b.toString(16).padStart(2,'0')).join('');
      if(digest!==result.data.planDigest||this.config!==config||this.getContextRevision()!==revision||signal?.aborted)return fail;
      return result;
    }catch{return fail}
  }
  async approveDeploymentAction(requestId:string,planId:string,plan:DeploymentPlan,clientRequestId:string,reviewedExactAction:true,signal?:AbortSignal,governanceBaselineDigest?:string):Promise<ReleasePlanResult<{approval:DeploymentApproval;executionAvailable:false}>> {
    const revision=this.getContextRevision(),parsed=deploymentPlanSchema.safeParse(plan);
    const fail={ok:false as const,error:'Review the exact deployment action again.',outcomeUnconfirmed:false};
    if(governanceBaselineDigest!==undefined&&!/^[a-f0-9]{64}$/.test(governanceBaselineDigest)||!parsed.success||reviewedExactAction!==true||!validOperationUuid(clientRequestId)||!/^[A-Za-z0-9_-]{1,160}$/.test(requestId)||!/^release_plan_[a-f0-9]{64}$/.test(planId)||parsed.data.releaseId!==requestId||parsed.data.planId!==planId||signal?.aborted)return fail;
    const normalize=(v:unknown):unknown=>Array.isArray(v)?v.map(normalize):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,value])=>[k,normalize(value)])):v;
    let digest:string;try{digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(normalize(parsed.data))))),b=>b.toString(16).padStart(2,'0')).join('')}catch{return fail}
    if(this.getContextRevision()!==revision||signal?.aborted)return fail;
    return releaseOperationPlanRequest(this.savedTaskContext(),'POST',`/api/desktop/deployments/${requestId}/operation-plans/${planId}/deployment-approval`,{plan:parsed.data,clientRequestId,reviewedExactAction,...(governanceBaselineDigest!==undefined?{governanceBaselineDigest}:{})},(value):value is {approval:DeploymentApproval;executionAvailable:false}=>{
      if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['approval','executionAvailable'].includes(k)))return false;
      const data=value as {approval?:unknown;executionAvailable?:unknown},a=deploymentApprovalSchema.safeParse(data.approval);
      return data.executionAvailable===false&&a.success&&a.data.governanceBaselineDigest===governanceBaselineDigest&&a.data.planDigest===digest&&a.data.organizationId===parsed.data.organizationId&&a.data.executorUserId===parsed.data.executorUserId&&a.data.sourcePolicy===parsed.data.sourcePolicy&&![parsed.data.creatorUserId,parsed.data.requesterUserId,parsed.data.executorUserId].includes(a.data.approverUserId)&&Date.parse(a.data.expiresAt)<=Date.parse(parsed.data.expiresAt);
    },signal);
  }
  deploymentExecution(requestId:string,planId:string,signal?:AbortSignal):Promise<ReleasePlanResult<DeploymentExecutionState>> {return this.deploymentExecutionRequest(requestId,planId,undefined,signal)}
  mutateDeploymentExecution(requestId:string,planId:string,input:{action:'prepare'|'execute'|'cancel'|'recover';expectedVersion:0|1|2;clientRequestId:string},signal?:AbortSignal):Promise<ReleasePlanResult<DeploymentExecutionState>> {
    if(!['prepare','execute','cancel','recover'].includes(input.action)||!validOperationUuid(input.clientRequestId)||Object.keys(input).some(k=>!['action','expectedVersion','clientRequestId'].includes(k))||(input.action==='recover'?![1,2].includes(input.expectedVersion):input.expectedVersion!==0))return Promise.resolve({ok:false,error:'Load deployment execution before another action.',outcomeUnconfirmed:false});
    return this.deploymentExecutionRequest(requestId,planId,input,signal);
  }
  private deploymentExecutionRequest(requestId:string,planId:string,body:{action:'prepare'|'execute'|'cancel'|'recover';expectedVersion:number;clientRequestId:string}|undefined,signal?:AbortSignal):Promise<ReleasePlanResult<DeploymentExecutionState>> {
    if(!/^[A-Za-z0-9_-]{1,160}$/.test(requestId)||!/^release_plan_[a-f0-9]{64}$/.test(planId))return Promise.resolve({ok:false,error:'Load deployment execution.',outcomeUnconfirmed:false});
    return releaseOperationPlanRequest(this.savedTaskContext(),body?'POST':'GET',`/api/desktop/deployments/${requestId}/operation-plans/${planId}/deployment-execution`,body,(v):v is DeploymentExecutionState=>{try{const d=parseDeploymentExecutionState(v);return !body||!!d.operation&&(body.action==='prepare'?d.operation.state==='prepared'&&d.operation.version===0:body.action==='cancel'?d.operation.state==='cancelled'&&d.operation.version===1:body.action==='recover'?['dispatching','unknown','accepted','refused'].includes(d.operation.state):['dispatching','unknown','accepted','refused'].includes(d.operation.state))}catch{return false}},signal);
  }
  providerMergeExecution(requestId:string,planId:string,signal?:AbortSignal):Promise<ReleasePlanResult<ProviderMergeExecutionState>> {
    return this.providerMergeExecutionRequest(requestId,planId,undefined,signal);
  }
  mutateProviderMergeExecution(requestId:string,planId:string,input:{action:'prepare'|'execute'|'cancel';expectedVersion:0|1|2;clientRequestId:string},signal?:AbortSignal):Promise<ReleasePlanResult<ProviderMergeExecutionState>> {
    if(!['prepare','execute','cancel'].includes(input.action)||input.expectedVersion!==0||!validOperationUuid(input.clientRequestId)||Object.keys(input).some(k=>!['action','expectedVersion','clientRequestId'].includes(k)))return Promise.resolve({ok:false,error:'Load merge execution before another action.',outcomeUnconfirmed:false});
    return this.providerMergeExecutionRequest(requestId,planId,input,signal);
  }
  private providerMergeExecutionRequest(requestId:string,planId:string,body:{action:'prepare'|'execute'|'cancel';expectedVersion:number;clientRequestId:string}|undefined,signal?:AbortSignal):Promise<ReleasePlanResult<ProviderMergeExecutionState>> {
    if(!/^[A-Za-z0-9_-]{1,160}$/.test(requestId)||!/^release_plan_[a-f0-9]{64}$/.test(planId))return Promise.resolve({ok:false,error:'Load merge execution.',outcomeUnconfirmed:false});
    return releaseOperationPlanRequest(this.savedTaskContext(),body?'POST':'GET',`/api/desktop/deployments/${requestId}/operation-plans/${planId}/provider-execution`,body,(v):v is ProviderMergeExecutionState=>{try{const parsed=parseProviderMergeExecutionState(v);return !body||!!parsed.operation&&(body.action==='prepare'?parsed.operation.state==='prepared'&&parsed.operation.version===0:body.action==='cancel'?parsed.operation.state==='cancelled'&&parsed.operation.version===1:['dispatching','unknown','confirmed','refused'].includes(parsed.operation.state))}catch{return false}},signal);
  }
  providerMergeOperation(requestId:string,planId:string,signal?:AbortSignal):Promise<ReleasePlanResult<ProviderMergeOperationResponse>> {
    return this.providerMergeOperationRequest(requestId,planId,undefined,signal);
  }
  recoverProviderMergeOperation(requestId:string,planId:string,expectedVersion:number,signal?:AbortSignal):Promise<ReleasePlanResult<ProviderMergeOperationResponse>> {
    if(!Number.isInteger(expectedVersion)||expectedVersion<0||expectedVersion>2)return Promise.resolve({ok:false,error:'Reload merge outcome.',outcomeUnconfirmed:false});
    return this.providerMergeOperationRequest(requestId,planId,{action:'recover',expectedVersion},signal);
  }
  private providerMergeOperationRequest(requestId:string,planId:string,body:unknown,signal?:AbortSignal):Promise<ReleasePlanResult<ProviderMergeOperationResponse>> {
    if(!/^[A-Za-z0-9_-]{1,160}$/.test(requestId)||!/^release_plan_[a-f0-9]{64}$/.test(planId))return Promise.resolve({ok:false,error:'Reload merge outcome.',outcomeUnconfirmed:false});
    return releaseOperationPlanRequest(this.savedTaskContext(),body?'POST':'GET',`/api/desktop/deployments/${requestId}/operation-plans/${planId}/provider-operation`,body,(v):v is ProviderMergeOperationResponse=>{try{parseReleaseProviderMergeOperationResponse(v);return true}catch{return false}},signal);
  }
  providerMergeApproval(requestId:string,planId:string,digest:string,signal?:AbortSignal):Promise<ReleasePlanResult<ProviderMergeApprovalState>> {
    return this.providerMergeApprovalRequest('GET',requestId,planId,digest,undefined,signal);
  }
  approveProviderMerge(requestId:string,planId:string,digest:string,input:{expectedPlanVersion:1;clientRequestId:string;sourcePolicy:'expected_head_observed_base';governanceBaselineDigest?:string},signal?:AbortSignal):Promise<ReleasePlanResult<ProviderMergeApprovalState>> {
    if(input.governanceBaselineDigest!==undefined&&!/^[a-f0-9]{64}$/.test(input.governanceBaselineDigest)||input.expectedPlanVersion!==1||input.sourcePolicy!=='expected_head_observed_base'||!validOperationUuid(input.clientRequestId)||Object.keys(input).some(k=>!['expectedPlanVersion','clientRequestId','sourcePolicy','governanceBaselineDigest'].includes(k)))return Promise.resolve({ok:false,error:'Reload provider merge approval.',outcomeUnconfirmed:false});
    return this.providerMergeApprovalRequest('POST',requestId,planId,digest,input,signal);
  }
  revokeProviderMergeApproval(requestId:string,planId:string,digest:string,input:{id:string;expectedVersion:0;clientRequestId:string},signal?:AbortSignal):Promise<ReleasePlanResult<ProviderMergeApprovalState>> {
    if(!/^release_provider_approval_[a-f0-9]{64}$/.test(input.id)||input.expectedVersion!==0||!validOperationUuid(input.clientRequestId)||Object.keys(input).some(k=>!['id','expectedVersion','clientRequestId'].includes(k)))return Promise.resolve({ok:false,error:'Reload provider merge approval.',outcomeUnconfirmed:false});
    return this.providerMergeApprovalRequest('DELETE',requestId,planId,digest,input,signal);
  }
  private providerMergeApprovalRequest(method:'GET'|'POST'|'DELETE',requestId:string,planId:string,digest:string,body:unknown,signal?:AbortSignal):Promise<ReleasePlanResult<ProviderMergeApprovalState>> {
    if(!/^[A-Za-z0-9_-]{1,160}$/.test(requestId)||!/^release_plan_[a-f0-9]{64}$/.test(planId)||!/^[a-f0-9]{64}$/.test(digest))return Promise.resolve({ok:false,error:'Reload provider merge approval.',outcomeUnconfirmed:false});
    return releaseOperationPlanRequest(this.savedTaskContext(),method,`/api/desktop/deployments/${encodeURIComponent(requestId)}/operation-plans/${planId}/provider-approval`,body,(v):v is ProviderMergeApprovalState=>isProviderMergeApprovalState(v,planId,digest)&&(method==='GET'||method==='POST'&&v.approval?.status==='approved'&&v.approval.version===0&&v.approval.governanceBaselineDigest===(body as {governanceBaselineDigest?:string}).governanceBaselineDigest||method==='DELETE'&&v.approval?.status==='revoked'&&v.approval.id===(body as {id:string}).id&&v.approval.version===1),signal);
  }
  releaseExecutionApproval(requestId:string,planId:string,digest:string,signal?:AbortSignal):Promise<ReleasePlanResult<ExecutionApprovalState>> {
    return this.executionApprovalRequest('GET',requestId,planId,digest,undefined,signal);
  }
  approveReleaseExecution(requestId:string,planId:string,digest:string,input:{expectedPlanVersion:1;clientRequestId:string},signal?:AbortSignal):Promise<ReleasePlanResult<ExecutionApprovalState>> {
    if(input.expectedPlanVersion!==1||!validOperationUuid(input.clientRequestId)||Object.keys(input).some(k=>!['expectedPlanVersion','clientRequestId'].includes(k)))return Promise.resolve({ok:false,error:'Reload execution approval.',outcomeUnconfirmed:false});
    return this.executionApprovalRequest('POST',requestId,planId,digest,input,signal);
  }
  revokeReleaseExecutionApproval(requestId:string,planId:string,digest:string,input:{id:string;expectedVersion:0;clientRequestId:string},signal?:AbortSignal):Promise<ReleasePlanResult<ExecutionApprovalState>> {
    if(!/^release_approval_[a-f0-9]{64}$/.test(input.id)||input.expectedVersion!==0||!validOperationUuid(input.clientRequestId)||Object.keys(input).some(k=>!['id','expectedVersion','clientRequestId'].includes(k)))return Promise.resolve({ok:false,error:'Reload execution approval.',outcomeUnconfirmed:false});
    return this.executionApprovalRequest('DELETE',requestId,planId,digest,input,signal);
  }
  private executionApprovalRequest(method:'GET'|'POST'|'DELETE',requestId:string,planId:string,digest:string,body:unknown,signal?:AbortSignal):Promise<ReleasePlanResult<ExecutionApprovalState>> {
    if(!/^[A-Za-z0-9_-]{1,160}$/.test(requestId)||!/^release_plan_[a-f0-9]{64}$/.test(planId)||!/^[a-f0-9]{64}$/.test(digest))return Promise.resolve({ok:false,error:'Reload execution approval.',outcomeUnconfirmed:false});
    return releaseOperationPlanRequest(this.savedTaskContext(),method,`/api/desktop/deployments/${encodeURIComponent(requestId)}/operation-plans/${planId}/execution-approval`,body,(v):v is ExecutionApprovalState=>isExecutionApprovalState(v,planId,digest)&&(method==='GET'||method==='POST'&&v.approval?.status==='approved'&&v.approval.version===0||method==='DELETE'&&v.approval?.status==='revoked'&&v.approval.id===(body as {id:string}).id&&v.approval.version===1),signal);
  }
  releaseOperationPlans(requestId:string,version:number,signal?:AbortSignal):Promise<ReleasePlanResult<OperationPlanList>> {
    if(!validOperationRelease(requestId,version))return Promise.resolve({ok:false,error:"Reload saved plans and read a fresh preview.",outcomeUnconfirmed:false});
    return releaseOperationPlanRequest(this.savedTaskContext(),'GET',`/api/desktop/deployments/${encodeURIComponent(requestId)}/operation-plans?expectedVersion=${version}`,undefined,(v):v is OperationPlanList=>isOperationPlanList(v,requestId,version),signal);
  }
  releaseOperationTargets(requestId:string,version:number,signal?:AbortSignal):Promise<ReleasePlanResult<ReleaseMergeTargets>> {
    if(!validOperationRelease(requestId,version))return Promise.resolve({ok:false,error:"Reload saved plans and read a fresh preview.",outcomeUnconfirmed:false});
    return releaseOperationPlanRequest(this.savedTaskContext(),'GET',`/api/desktop/deployments/${encodeURIComponent(requestId)}/merge-targets?expectedVersion=${version}`,undefined,(v):v is ReleaseMergeTargets=>isReleaseMergeTargets(v,requestId,version),signal);
  }
  previewReleaseOperationPlan(requestId:string,version:number,number:number,method:ReleaseMergeMethod,signal?:AbortSignal):Promise<ReleasePlanResult<OperationPlanPreview>> {
    if(!validOperationRelease(requestId,version)||!Number.isSafeInteger(number)||number<1||number>2147483647||!['merge','squash','rebase'].includes(method))return Promise.resolve({ok:false,error:"Reload saved plans and read a fresh preview.",outcomeUnconfirmed:false});
    return releaseOperationPlanRequest(this.savedTaskContext(),'GET',`/api/desktop/deployments/${encodeURIComponent(requestId)}/operation-plans/preview?expectedVersion=${version}&pullRequestNumber=${number}&method=${method}`,undefined,(v):v is OperationPlanPreview=>isOperationPlanPreview(v,requestId,version,number,method),signal);
  }
  saveReleaseOperationPlan(requestId:string,input:{expectedVersion:number;previewToken:string},signal?:AbortSignal):Promise<ReleasePlanResult<OperationPlanMutation>> {
    if(!validOperationRelease(requestId,input.expectedVersion)||!validOperationToken(input.previewToken)||Object.keys(input).some(k=>!['expectedVersion','previewToken'].includes(k)))return Promise.resolve({ok:false,error:"Reload saved plans and read a fresh preview.",outcomeUnconfirmed:false});
    return releaseOperationPlanRequest(this.savedTaskContext(),'POST',`/api/desktop/deployments/${encodeURIComponent(requestId)}/operation-plans`,input,(v):v is OperationPlanMutation=>isOperationPlanMutation(v,requestId,input.expectedVersion),signal);
  }
  reviewReleaseOperationPlan(requestId:string,releaseVersion:number,planId:string,input:{expectedPlanVersion:number;previewToken:string;decision:'reviewed'|'rejected';clientRequestId:string},signal?:AbortSignal):Promise<ReleasePlanResult<OperationPlanMutation>> {
    if(!validOperationRelease(requestId,releaseVersion)||!/^release_plan_[a-f0-9]{64}$/.test(planId)||!validOperationVersion(input.expectedPlanVersion)||!validOperationToken(input.previewToken)||!validOperationUuid(input.clientRequestId)||!['reviewed','rejected'].includes(input.decision)||Object.keys(input).some(k=>!['expectedPlanVersion','previewToken','decision','clientRequestId'].includes(k)))return Promise.resolve({ok:false,error:"Reload saved plans and read a fresh preview.",outcomeUnconfirmed:false});
    return releaseOperationPlanRequest(this.savedTaskContext(),'POST',`/api/desktop/deployments/${encodeURIComponent(requestId)}/operation-plans/${encodeURIComponent(planId)}/review`,input,(v):v is OperationPlanMutation=>isOperationPlanMutation(v,requestId,releaseVersion,planId)&&v.plan.version>input.expectedPlanVersion,signal);
  }
  cancelReleaseOperationPlan(requestId:string,releaseVersion:number,planId:string,input:{expectedPlanVersion:number;clientRequestId:string},signal?:AbortSignal):Promise<ReleasePlanResult<OperationPlanMutation>> {
    if(!validOperationRelease(requestId,releaseVersion)||!/^release_plan_[a-f0-9]{64}$/.test(planId)||!validOperationVersion(input.expectedPlanVersion)||!validOperationUuid(input.clientRequestId)||Object.keys(input).some(k=>!['expectedPlanVersion','clientRequestId'].includes(k)))return Promise.resolve({ok:false,error:"Reload saved plans and read a fresh preview.",outcomeUnconfirmed:false});
    return releaseOperationPlanRequest(this.savedTaskContext(),'DELETE',`/api/desktop/deployments/${encodeURIComponent(requestId)}/operation-plans/${encodeURIComponent(planId)}`,input,(v):v is OperationPlanMutation=>isOperationPlanMutation(v,requestId,releaseVersion,planId,true)&&v.plan.version>input.expectedPlanVersion,signal);
  }
  releaseMergeTargets(requestId: string, version: number): Promise<ApiResult<ReleaseMergeTargets>> {
    return this.pairedValidatedRequest("GET", `/api/desktop/deployments/${encodeURIComponent(requestId)}/merge-targets?expectedVersion=${version}`, undefined,
      (value): value is ReleaseMergeTargets => isReleaseMergeTargets(value, requestId, version), "Merge review");
  }
  releaseMergePlan(requestId: string, version: number, number: number, method: ReleaseMergeMethod, repository: string): Promise<ApiResult<ReleaseMergePlanEvidence>> {
    return this.pairedValidatedRequest("GET", `/api/desktop/deployments/${encodeURIComponent(requestId)}/merge-plan?expectedVersion=${version}&pullRequestNumber=${number}&method=${encodeURIComponent(method)}`, undefined,
      (value): value is ReleaseMergePlanEvidence => isReleaseMergePlanEvidence(value, requestId, version, number, method, repository), "Merge review");
  }
  releaseBatchWait(requestId: string, version: number): Promise<ApiResult<ReleaseBatchWaitState>> {
    return this.pairedValidatedRequest("GET", `/api/desktop/deployments/${encodeURIComponent(requestId)}/batch-wait?expectedVersion=${version}`, undefined,
      (value): value is ReleaseBatchWaitState => isReleaseBatchWaitState(value, version));
  }
  startReleaseBatchWait(requestId: string, version: number, deadlineAt: number): Promise<ApiResult<ReleaseBatchWait>> {
    return this.pairedValidatedRequest("POST", `/api/desktop/deployments/${encodeURIComponent(requestId)}/batch-wait`, { expectedVersion: version, deadlineAt }, isReleaseBatchWait);
  }
  cancelReleaseBatchWait(requestId: string, waitId: string, waitVersion: number): Promise<ApiResult<ReleaseBatchWait>> {
    return this.pairedValidatedRequest("DELETE", `/api/desktop/deployments/${encodeURIComponent(requestId)}/batch-wait`, { waitId, expectedWaitVersion: waitVersion }, isReleaseBatchWait);
  }
  private async pairedValidatedRequest<T>(method: "GET" | "POST" | "DELETE", path: string, body: unknown, validate: (value: unknown) => value is T, label = "Batch monitoring"): Promise<ApiResult<T>> {
    if (!this.config.sessionToken?.startsWith("axm.desk.")) return { ok: false, error: "A paired desktop session is required." };
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const operation = (async (): Promise<ApiResult<T>> => {
        const response = await fetch(`${this.config.apiBase}${path}`, { method, credentials: "omit", cache: "no-store", signal: controller.signal,
          headers: { ...this.headers(), ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
        const payload = await response.json().catch(() => null) as { ok?: boolean; data?: unknown } | null;
        if (!controller.signal.aborted && response.ok && payload?.ok === true && validate(payload.data)) return { ok: true, data: payload.data };
        return { ok: false, error: `${label} could not be confirmed. Refresh its status.` };
      })();
      return await Promise.race([operation, new Promise<ApiResult<T>>(resolve => { timer = setTimeout(() => { controller.abort(); resolve({ ok: false, error: `${label} timed out. Refresh its status before trying again.` }); }, 25_000); })]);
    } catch { return { ok: false, error: `${label} could not be confirmed. Refresh its status.` }; }
    finally { if (timer !== undefined) clearTimeout(timer); controller.abort(); }
  }

  releaseBatchReadiness(requestId: string, version: number): Promise<ApiResult<{ ready: true; requestVersion: number } | { ready: false; reason: "unavailable" | "changed" | "waiting" }>> {
    return this.get(`/api/desktop/deployments/${encodeURIComponent(requestId)}/batch-readiness?expectedVersion=${version}`);
  }

  deploymentRequestForRevision(requestId: string): Promise<ApiResult<{
    id: string;
    version: number;
    intake: Record<string, unknown>;
  }>> {
    return this.get(`/api/desktop/deployments/${encodeURIComponent(requestId)}`);
  }

  reviseDeploymentRequest(
    requestId: string,
    expectedVersion: number,
    intake: Record<string, unknown>,
  ): Promise<ApiResult<{
    id: string;
    title: string;
    status: string;
    version: number;
    changed: boolean;
  }>> {
    return this.put(
      `/api/desktop/deployments/${encodeURIComponent(requestId)}`,
      { ...intake, expectedVersion },
    );
  }

  closeDeploymentRequest(
    requestId: string,
    expectedVersion: number,
    closureEvidenceId: string,
    closureSummary: string,
  ): Promise<ApiResult<{ id: string; status: string; closedAt: string | null }>> {
    return this.post(
      `/api/desktop/deployments/${encodeURIComponent(requestId)}/close`,
      { expectedVersion, closureEvidenceId, closureSummary },
    );
  }

  deploymentRequestHistory(requestId: string): Promise<ApiResult<Array<{
    version: number;
    createdAt: string;
    author: "You" | "Workspace member";
    changes: string[];
  }>>> {
    return this.get(`/api/desktop/deployments/${encodeURIComponent(requestId)}/history`);
  }

  deploymentOperations(requestId: string): Promise<ApiResult<Array<{
    kind: string;
    status: string;
    attemptCount: number;
    createdAt: string;
    lastAttemptAt: string | null;
    lastReconciledAt: string | null;
    externallyReferenced: boolean;
  }>>> {
    return this.get(`/api/desktop/deployments/${encodeURIComponent(requestId)}/operations`);
  }

  collectGitHubReleaseEvidence(requestId: string): Promise<ApiResult<{
    mode: "read_only_evidence";
    repositories: Array<{
      repository: string;
      state: "observed" | "unavailable";
      branchProtection: "protected" | "not_protected" | "unavailable";
      repositoryEnabled: boolean | null;
      latestWorkflow: "passed" | "failed" | "in_progress" | "not_reported" | "unavailable";
    }>;
    pullRequests: Array<{
      repository: string;
      number: number;
      state: "observed" | "unavailable";
      pullRequestState: "open" | "closed" | "merged" | "draft" | "unknown";
      targetBranchMatches: boolean | null;
      checks: "passed" | "failed" | "in_progress" | "not_reported" | "unavailable";
    }>;
  }>> {
    return this.post(`/api/desktop/deployments/${encodeURIComponent(requestId)}/github-evidence`, {});
  }

  generateDeploymentPlaybook(requestId: string): Promise<ApiResult<{
    id: string;
    requestId: string;
    version: number;
    status: string;
    contentHash: string;
    generatedAtUtc: string;
    scope: string;
    stepCount: number;
    steps: Array<{
      id: string;
      order: number;
      type: string;
      title: string;
      requiredRole: string;
      requiresHumanConfirmation: boolean;
      evidenceRequired: boolean;
      instructions: string;
      validationInstruction?: string;
      activation: "always" | "on_success" | "on_failure";
      status: string;
    }>;
  }>> {
    return this.post(
      `/api/desktop/deployments/${encodeURIComponent(requestId)}/playbooks`,
      {},
    );
  }

  latestDeploymentPlaybook(requestId: string): Promise<ApiResult<{
    id: string;
    requestId: string;
    version: number;
    status: string;
    contentHash: string;
    generatedAtUtc: string;
    scope: string;
    stepCount: number;
    steps: Array<{
      id: string;
      order: number;
      title: string;
      requiredRole: string;
      activation: "always" | "on_success" | "on_failure";
      evidenceRequired: boolean;
      validationInstruction?: string;
    }>;
  }>> {
    return this.get(`/api/desktop/deployments/${encodeURIComponent(requestId)}/playbooks`);
  }

  // ── Release manifest ──────────────────────────────────────────────
  releaseManifest(): Promise<ApiResult<{ source: string; tag?: string; assets: Record<string, unknown> }>> {
    return this.get("/api/desktop/release-manifest");
  }

  // ── Release workspace (paired session; never dashboard cookie auth) ──
  releaseWorkspaceList(): Promise<ApiResult<{ releases: Array<{ id: string; releaseTag: string | null; applicationId: string }> }>> {
    return this.get("/api/desktop/release-workspace");
  }

  releaseWorkspaceDetail(releaseId: string): Promise<ApiResult<unknown>> {
    return this.get(`/api/desktop/release-workspace/${encodeURIComponent(releaseId)}`);
  }

  releaseWorkspaceActivity(releaseId: string): Promise<ApiResult<{ releaseId: string; events: Array<{ kind: string; atIso: string; actorUserId: string | null; summary: string; tone: "info" | "success" | "warning" | "danger" }> }>> {
    return this.get(`/api/desktop/release-workspace/${encodeURIComponent(releaseId)}/activity`);
  }

  transitionReleaseWorkspace(input: { releaseId: string; action: "finalize_scope" | "start_deploy" | "complete_deploy" | "mark_rolled_back" | "mark_failed" }): Promise<ApiResult<{ previousStatus: string; status: string }>> {
    return this.post("/api/desktop/release-workspace/lifecycle", input);
  }

  // ── Applications (paired session; never dashboard cookie auth) ──
  applications(): Promise<ApiResult<{ generatedAt: string; applications: Array<{ id: string; slug: string; name: string; ownerTeamLabel: string | null; businessTier: string | null; description: string | null; componentCount: number; releaseCount: number; releasesDeployed: number; createdAtIso: string }>; summary: { total: number; withReleases: number; totalComponents: number } }>> {
    return this.get("/api/desktop/applications");
  }

  createApplication(input: { slug: string; name: string; ownerTeamLabel?: string; businessTier?: string; description?: string }): Promise<ApiResult<{ created: boolean; slug: string }>> {
    return this.post("/api/desktop/applications", input);
  }

  // ── Onboarding checklist (paired session; never dashboard cookie auth) ──
  onboardingChecklist(): Promise<ApiResult<{ generatedAt: string; checklist: { items: Array<{ key: string; title: string; description: string; done: boolean; cta: { label: string; href: string }; blockedByPredecessor: boolean }>; completed: number; total: number; percent: number; allDone: boolean } }>> {
    return this.get("/api/desktop/onboarding-checklist");
  }

  // -------------------------------------------------------------------------
  // HTTP helpers
  // -------------------------------------------------------------------------

  private async get<T>(path: string, credential?: string): Promise<ApiResult<T>> {
    try {
      const res = await fetch(`${this.config.apiBase}${path}`, {
        headers: credential ? { ...this.headers(), Authorization: `Bearer ${credential}` } : this.headers(),
        credentials: "include",
      });
      const json = (await res.json().catch(() => ({}))) as LegacyApiErrorBody & { ok?: boolean; data?: unknown };
      if (res.ok && json.ok && json.data !== undefined) return { ok: true, data: json.data as T };
      return { ok: false, error: legacyApiError(json, res.status) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * v1 envelope: { ok, ...payload } on success, { ok: false, error, message?, retryAfterSeconds? }
   * on failure. Different shape from the legacy { ok, data } wrap — the v1
   * routes return the payload at the top level (see app/api/v1/*).
   */
  private async getV1<T>(path: string): Promise<ApiResult<T>> {
    return this.executeV1<T>("GET", path);
  }

  /**
   * POST variant of getV1. Accepts a JSON body + optional extra headers
   * (e.g. `Idempotency-Key` for Phase 402's deduplication).
   */
  private async postV1<T>(
    path: string,
    body: Record<string, unknown>,
    extraHeaders?: Record<string, string>,
  ): Promise<ApiResult<T>> {
    return this.executeV1<T>("POST", path, JSON.stringify(body), extraHeaders);
  }

  private async executeV1<T>(
    method: "GET" | "POST",
    path: string,
    body?: string,
    extraHeaders?: Record<string, string>,
  ): Promise<ApiResult<T>> {
    try {
      const res = await fetch(`${this.config.apiBase}${path}`, {
        method,
        headers: {
          ...this.headers(),
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(extraHeaders ?? {}),
        },
        body,
      });
      const text = await res.text();
      let parsed: Record<string, unknown> = {};
      try { parsed = text.length > 0 ? JSON.parse(text) : {}; } catch { /* leave empty */ }
      if (res.ok && parsed.ok === true) {
        return { ok: true, data: parsed as unknown as T };
      }
      return { ok: false, error: v1ApiError(parsed, res.status) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private async post<T>(
    path: string,
    body: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<ApiResult<T>> {
    try {
      const res = await fetch(`${this.config.apiBase}${path}`, {
        method: "POST",
        headers: {
          ...this.headers(),
          "Content-Type": "application/json",
          ...(extraHeaders ?? {}),
        },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as LegacyApiErrorBody & { ok?: boolean; data?: unknown };
      if (json.ok && json.data !== undefined) return { ok: true, data: json.data as T };
      return { ok: false, error: legacyApiError(json, res.status) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private async put<T>(path: string, body: unknown): Promise<ApiResult<T>> {
    try {
      const res = await fetch(`${this.config.apiBase}${path}`, {
        method: "PUT",
        headers: { ...this.headers(), "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as LegacyApiErrorBody & { ok?: boolean; data?: unknown };
      if (json.ok && json.data !== undefined) return { ok: true, data: json.data as T };
      return { ok: false, error: legacyApiError(json, res.status) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private async patch<T>(path: string, body: unknown): Promise<ApiResult<T>> {
    try {
      const res = await fetch(`${this.config.apiBase}${path}`, {
        method: "PATCH",
        headers: { ...this.headers(), "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as LegacyApiErrorBody & { ok?: boolean; data?: unknown };
      if (json.ok && json.data !== undefined) return { ok: true, data: json.data as T };
      return { ok: false, error: legacyApiError(json, res.status) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private async delete<T>(path: string): Promise<ApiResult<T>> {
    try {
      const res = await fetch(`${this.config.apiBase}${path}`, { method: "DELETE", headers: this.headers(), credentials: "include" });
      const json = (await res.json().catch(() => ({}))) as LegacyApiErrorBody & { ok?: boolean; data?: unknown };
      if (json.ok && json.data !== undefined) return { ok: true, data: json.data as T };
      return { ok: false, error: legacyApiError(json, res.status) };
    } catch (err) { return { ok: false, error: err instanceof Error ? err.message : String(err) }; }
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { Accept: "application/json" };
    if (this.config.sessionToken) h["Authorization"] = `Bearer ${this.config.sessionToken}`;
    return h;
  }
}

/** Module-level singleton (most desktop code wants one client). */
export const desktopClient = new DesktopClient();

function validOperationVersion(value:number){return Number.isSafeInteger(value)&&value>=0&&value<=2147483647}
function validOperationRelease(id:string,version:number){return typeof id==='string'&&/^[A-Za-z0-9_-]{1,200}$/.test(id)&&validOperationVersion(version)&&version>0}
function validOperationToken(value:string){return typeof value==='string'&&/^\S{1,256}$/.test(value)}
function validOperationUuid(value:string){return typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value)}


export type BatchProviderId = "prefect" | "dagster" | "argo_workflows";
export interface BatchConnectionState { provider: BatchProviderId; label?: string; connected?: boolean; status: string; baseUrl?: string | null; namespace?: string | null; inventoryCount?: number | null; lastValidatedAt?: string | null; authority: "observation_only" }
