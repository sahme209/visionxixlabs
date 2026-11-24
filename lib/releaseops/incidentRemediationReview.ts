import {z} from "zod";
import {remediationReviewBinding} from "../tauri/incidentRemediationReviewContract";

const savedInputs = z.object({
  incident: z.object({id:z.string(), reportedAtIso:z.string().datetime()}),
  release: z.object({id:z.string(), releaseTag:z.string().nullable()}),
  reviewBinding: remediationReviewBinding.optional(),
});

export function projectIncidentRemediationReview(
  incident: {id:string; organizationId:string; releaseId:string; reportedAt:Date; updatedAt:Date},
  release: {id:string; organizationId:string; applicationId:string; targetEnvironmentId:string|null; commitSha:string|null; releaseTag:string|null},
  proposal: {id:string; organizationId:string; incidentId:string; title:string; inputsJson:unknown; generatedAt:Date;
    operatorDecision:string; decidedAt:Date|null; decidedByUserId:string|null} | null,
) {
  if (!proposal || proposal.organizationId !== incident.organizationId || proposal.incidentId !== incident.id ||
      release.id !== incident.releaseId || release.organizationId !== incident.organizationId) return null;
  const saved = savedInputs.safeParse(proposal.inputsJson);
  if (!saved.success || saved.data.incident.id !== incident.id || saved.data.release.id !== release.id ||
      saved.data.incident.reportedAtIso !== incident.reportedAt.toISOString() || proposal.generatedAt < incident.reportedAt) return null;
  const binding = saved.data.reviewBinding;
  const current = binding?.incidentRevision === incident.updatedAt.toISOString() &&
    binding.applicationId === release.applicationId && binding.environmentId === release.targetEnvironmentId &&
    binding.commit === release.commitSha && saved.data.release.releaseTag === release.releaseTag;
  const decision = proposal.operatorDecision;
  if (decision !== "pending" && decision !== "dismissed" && decision !== "accepted" &&
      decision !== "rejected" && decision !== "implemented") return null;
  const decided = !!proposal.decidedByUserId && !!proposal.decidedAt && proposal.decidedAt >= proposal.generatedAt;
  if (!decided && (decision === "accepted" || decision === "rejected" || decision === "implemented")) return null;
  return {
    id:proposal.id, title:proposal.title.trim().slice(0,160), generatedAt:proposal.generatedAt.toISOString(),
    decision:decision === "dismissed" && !decided ? "superseded" as const : decision,
    decidedAt:decided && decision !== "pending" ? proposal.decidedAt!.toISOString() : null,
    binding:current ? "current" as const : "historical" as const,
  };
}
