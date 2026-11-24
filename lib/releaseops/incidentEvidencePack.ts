import {z} from "zod";
import type {IncidentEvidence} from "@/lib/tauri/ticketDirectoryContract";
import {sha256OfCanonicalJson} from "./evidencePackGenerator";

const instant = z.string().datetime();
const evidenceContent = z.object({
  schemaVersion: z.literal(2),
  generatedAtIso: instant,
  release: z.object({id: z.string(), releaseTag: z.string().nullable(), commitSha: z.string().regex(/^[a-f0-9]{40}([a-f0-9]{24})?$/i)}),
  branchValidation: z.object({total: z.number().int().nonnegative(), checks: z.array(z.unknown())}),
  changeTickets: z.object({count: z.number().int().nonnegative(), items: z.array(z.unknown())}),
  readiness: z.object({overallScore: z.number().int().min(0).max(100), evaluatedAt: instant}).nullable(),
});

export function summarizeIncidentEvidence(
  row: {organizationId: string; releaseId: string; contentHash: string | null; contentJson: unknown} | null,
  release: {organizationId: string; id: string; releaseTag: string | null; commitSha: string | null},
): IncidentEvidence {
  if (!row) return {state: "missing"};
  const unavailable = {state: "unavailable"} as const;
  if (row.organizationId !== release.organizationId || row.releaseId !== release.id || !release.commitSha) return unavailable;
  const decoded = evidenceContent.safeParse(row.contentJson);
  if (!decoded.success || !row.contentHash) return unavailable;
  const data = decoded.data;
  if (data.release.id !== release.id || data.release.releaseTag !== release.releaseTag || data.release.commitSha !== release.commitSha
    || data.branchValidation.total !== data.branchValidation.checks.length || data.changeTickets.count !== data.changeTickets.items.length) return unavailable;

  // The v2 writer hashed readiness.evaluatedAt as a Date before Prisma serialized it.
  const original = row.contentJson as Record<string, unknown>;
  const legacy = data.readiness && {...original, readiness: {
    ...(original.readiness as Record<string, unknown>), evaluatedAt: {},
  }};
  const fullDigestMatches = sha256OfCanonicalJson(original) === row.contentHash;
  if (!fullDigestMatches && (!legacy || sha256OfCanonicalJson(legacy) !== row.contentHash)) return unavailable;

  return {
    state: "recorded",
    generatedAt: data.generatedAtIso,
    branchCheckCount: data.branchValidation.total,
    changeTicketCount: data.changeTickets.count,
    readiness: data.readiness ? {score: data.readiness.overallScore, evaluatedAt: fullDigestMatches ? data.readiness.evaluatedAt : null} : null,
  };
}

/** Take a bounded snapshot of the verified fields an incident update can retain. */
export function incidentEvidenceReference(row: Parameters<typeof summarizeIncidentEvidence>[0],
  release: Parameters<typeof summarizeIncidentEvidence>[1]) {
  const summary = summarizeIncidentEvidence(row, release);
  if (summary.state !== "recorded" || !row?.contentHash || !release.commitSha || !/^[a-f0-9]{64}$/.test(row.contentHash)) return null;
  return {
    commit: release.commitSha, digest: row.contentHash, generatedAt: summary.generatedAt,
    branchCheckCount: summary.branchCheckCount, changeTicketCount: summary.changeTicketCount,
  };
}
