import { z } from "zod";
import { sha256ContentHash } from "./contentHash";
import type { DeploymentRequestRepo, DeploymentRequestRow } from "./deploymentRequestRepo";

/** An unresolved ticket is deliberately not a DeploymentIntake or execution plan. */
const schema = z.object({
  kind: z.literal("resolution_draft"),
  schemaVersion: z.literal(1),
  id: z.string().trim().min(1).max(160),
  tenantId: z.string().trim().min(1).max(160),
  title: z.string().trim().min(1).max(200),
  applications: z.array(z.string().trim().min(1).max(120)).min(1).max(20),
  requestDetails: z.string().trim().min(1).max(10_000),
  applicationContact: z.string().trim().min(1).max(200).optional(),
  ticketUrl: z.string().max(2048).url().refine(value => {
    try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; }
  }, "Use an HTTPS ticket link without embedded credentials.").optional(),
}).strict();
export type ReleaseResolutionDraft = z.infer<typeof schema>;
export function parseReleaseResolutionDraft(value: unknown) {
  const result = schema.safeParse(value);
  return result.success ? { ok: true as const, draft: result.data } : {
    ok: false as const,
    issues: result.error.issues.map(issue => ({ field: issue.path.join(".") || "body", message: issue.message })),
  };
}

type Result = { ok: true; request: DeploymentRequestRow; replayed: boolean }
  | { ok: false; reason: "validation_failed" | "tenant_mismatch" | "correlation_conflict" };
export async function createReleaseResolutionDraft(repo: DeploymentRequestRepo, input: {
  organizationId: string; requesterUserId: string; actorRole: string; correlationId: string; draft: unknown;
}): Promise<Result> {
  const parsed = parseReleaseResolutionDraft(input.draft);
  if (!parsed.ok) return { ok: false, reason: "validation_failed" };
  const draft = parsed.draft;
  if (draft.tenantId !== input.organizationId) return { ok: false, reason: "tenant_mismatch" };
  return repo.$transaction(async tx => {
    const existing = await tx.tauriDeploymentRequest.findFirst({ where: { organizationId: input.organizationId, correlationId: input.correlationId } });
    if (existing) {
      const stored = parseReleaseResolutionDraft(existing.intakeJson);
      if (!stored.ok) return { ok: false, reason: "correlation_conflict" };
      const { id: _oldId, ...oldContent } = stored.draft;
      const { id: _newId, ...newContent } = draft;
      return sha256ContentHash(oldContent) === sha256ContentHash(newContent)
        ? { ok: true, request: existing, replayed: true }
        : { ok: false, reason: "correlation_conflict" };
    }
    const request = await tx.tauriDeploymentRequest.create({ data: {
      id: draft.id, organizationId: input.organizationId, requesterUserId: input.requesterUserId,
      title: draft.title, status: "draft", correlationId: input.correlationId,
      intakeJson: draft, version: 1, submittedAt: null,
    } });
    await tx.tauriDeploymentRequestVersion.create({ data: {
      organizationId: input.organizationId, deploymentRequestId: request.id, version: request.version,
      intakeJson: draft, contentHash: sha256ContentHash(draft), createdByUserId: input.requesterUserId,
    } });
    await tx.tauriAuditEvent.create({ data: {
      organizationId: input.organizationId, deploymentRequestId: request.id, actorUserId: input.requesterUserId,
      actorRole: input.actorRole, action: "deployment_request.draft_created",
      newValueJson: { version: request.version, status: "draft", title: draft.title, needsResolution: true },
      source: "desktop", correlationId: input.correlationId, timeZone: "UTC",
    } });
    return { ok: true, request, replayed: false };
  });
}
