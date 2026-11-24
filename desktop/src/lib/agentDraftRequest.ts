export type HomePlanningIntent = "release" | "change" | "issue" | "ask";

export const HOME_DRAFT_MAX_LENGTH = 2000;

export interface HomePlanningContext {
  repository?: string;
  environmentSlug?: string;
}

export interface AgentDraftRequest {
  text: string;
  context: object;
  revision: number;
  identityKey: string;
}

const instructions: Record<HomePlanningIntent, string> = {
  release: "Prepare a release plan for review.",
  change: "Analyze the proposed change and summarize its likely impact.",
  issue: "Investigate the issue and distinguish verified findings from hypotheses.",
  ask: "",
};

export function agentDraftText(intent: HomePlanningIntent, value: string, context?: HomePlanningContext): string | undefined {
  const text = value.trim();
  if (!text || text.length > HOME_DRAFT_MAX_LENGTH) return undefined;
  const instruction = instructions[intent];
  const recordedContext = [
    context?.repository && `Workspace repository: ${JSON.stringify(context.repository)}`,
    context?.environmentSlug && `Workspace environment: ${JSON.stringify(context.environmentSlug)}`,
  ].filter(Boolean).join("\n");
  return [instruction, recordedContext, text].filter(Boolean).join("\n\n");
}
