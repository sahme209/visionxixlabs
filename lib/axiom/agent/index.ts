export type {
  RunAgentInput,
  ApprovalInput,
  AgentRunResult,
  AgentTrigger,
  AgentRunStatus,
  AgentFinding,
  FindingCategory,
  FindingSeverity,
  ActionDisposition,
  AgentRecommendation,
  AgentActionPlan,
  ApprovalItem,
  AgentApplyResult,
  AgentMessage,
  AgentMessageType,
} from "./types";

export { runAgent, handleApproval } from "./runAgent";
export { generateSnapshot } from "./providerRegistry";
export type { SnapshotGenerator } from "./providerRegistry";
export { classifyDisposition, findingToRecommendation, priorityScore, classifyDispositionWithPrefs, findingToRecommendationWithPrefs, priorityScoreWithPrefs } from "./prioritizer";
export { loadPreferences, savePreferences, filterIgnoredFindings, applyDispositionPolicy, applyRiskTolerance, categoryBoost, agentTone } from "./preferences";
export type { OrgPreferences, PreferenceUpdates } from "./preferences";
export { buildRecommendations } from "./recommendationBuilder";
export type { RichRecommendation } from "./recommendationBuilder";
export * as agentMessages from "./messageBuilder";
export { runFirstExperience } from "./onboarding";
export type { OnboardingInput, OnboardingSummary, OnboardingFinding, OnboardingNextStep } from "./onboarding";
export {
  resolvePolicy,
  resolveDisposition,
  applyAutopilotToRecommendations,
  changeAutopilotMode,
  logAutopilotAction,
  loadAutopilotMode,
  isEscalation,
  getModeConfirmationCopy,
  MODE_COPY,
  MODE_ORDER,
} from "./autopilot";
export type { AutopilotMode, AutopilotPolicy, AutopilotDecision, AutopilotModeCopy } from "./autopilot";
export { buildMultiCloudSummary } from "./multiCloudSummary";
export type { MultiCloudSummary, ProviderRunInput } from "./multiCloudSummary";
export { prioritizeMultiCloudRecommendations, runPrioritizerTests, SCORING_RULES } from "./multiCloudPrioritizer";
export type { PrioritizedRecommendation, MultiCloudRecommendationInput, ScoreBreakdown } from "./multiCloudPrioritizer";
