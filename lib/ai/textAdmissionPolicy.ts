import "server-only";
import { effectiveGatewayModel } from "./effectiveGatewayModel";
import type { Prisma } from "@prisma/client";
import { normalizeStoredWorkspaceAIProviderPolicy, resolveWorkspaceAIProviderPolicy } from "./workspaceProviderPolicy";
import { isGatewayModelId, isConcreteGatewayModelId } from "./gatewayModelCatalog";

/** Server-resolved model, never a request-body policy or an environment opt-in. */
export type TextAdmissionPolicyRequirement = Readonly<{ provider: "vercel_gateway"; model: string; defaultModel?: string }>;
const unavailable = (): never => { throw new Error("ai_text_policy_unavailable"); };
export function pinTextAdmissionPolicy(value: TextAdmissionPolicyRequirement | undefined): TextAdmissionPolicyRequirement {
  if (!value) return unavailable();
  if (value.provider !== "vercel_gateway" || !isConcreteGatewayModelId(value.model)
      || (value.defaultModel !== undefined && !isGatewayModelId(value.defaultModel))) unavailable();
  return Object.freeze({ provider: value.provider, model: value.model, ...(value.defaultModel === undefined ? {} : { defaultModel: value.defaultModel }) });
}
/** Current policy shares a row lock with supported standalone policy upserts.
 * This is a logical decision point, not cancellation of an already sent request. */
export async function assertTextAdmissionPolicy(tx: Pick<Prisma.TransactionClient, "$queryRawUnsafe">, organizationId: string, requirement: TextAdmissionPolicyRequirement): Promise<void> {
  const exact = pinTextAdmissionPolicy(requirement);
  if (!organizationId) unavailable();
  const rows = await tx.$queryRawUnsafe<Array<{ enabled: unknown; allowedProviders: unknown; modelSelections: unknown; fallbackOrder: unknown }>>(
    'SELECT enabled,"allowedProviders","modelSelections","fallbackOrder" FROM "OrganizationAIProviderPolicy" WHERE "organizationId"=$1 FOR SHARE', organizationId,
  ).catch(() => unavailable());
  if (rows.length !== 1) unavailable();
  const stored = normalizeStoredWorkspaceAIProviderPolicy(rows[0]);
  const current = resolveWorkspaceAIProviderPolicy({ stored, serviceEnabled: ["vercel_gateway"] });
  if (!current.enabled || !current.allowedProviders.includes(exact.provider)
      || effectiveGatewayModel({ modelSelection: current.modelSelections.vercel_gateway, defaultModel: exact.defaultModel }) !== exact.model) unavailable();
}
