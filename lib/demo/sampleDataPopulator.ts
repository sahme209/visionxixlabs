/**
 * Sales-led demo mode — sample-data populator.
 *
 * One-click seed for prospect demos. Drops representative rows into
 * the audit + queue + feedback + retry tables so a fresh dashboard
 * shows interesting data without anyone having to wire AWS first.
 *
 * Hard rules:
 *   - Tenant-scoped — never spills into other tenants.
 *   - Idempotency-keyed — repeating populate is a no-op (uses a
 *     stable id prefix `demo:` so the cleanup helper can remove
 *     exactly the demo rows without touching real data).
 *   - Best-effort writes — DB failure returns the partial outcome.
 *   - No outbound side-effects (Slack/Teams). Demo data MUST NOT
 *     leak to real channels.
 */

import "server-only";

import { prisma } from "@/lib/db";

const DEMO_PREFIX = "demo:";

export interface DemoPopulateOutcome {
  rationaleRows: number;
  runbookRows: number;
  notificationRows: number;
  feedbackRows: number;
  helpQueryRows: number;
  errors: string[];
}

export async function populateDemoData(opts: { organizationId: string }): Promise<DemoPopulateOutcome> {
  const out: DemoPopulateOutcome = {
    rationaleRows: 0,
    runbookRows: 0,
    notificationRows: 0,
    feedbackRows: 0,
    helpQueryRows: 0,
    errors: [],
  };
  const now = new Date();
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);

  // Rationale rows — 6 representative candidates across outcomes.
  const rationaleSeeds: Array<{
    id: string;
    candidateId: string;
    title: string;
    outcome: string;
    boundaryClass: string;
    haltedAtStage: string | null;
    haltReason: string | null;
    rootCause: string;
    minutesAgo: number;
  }> = [
    {
      id: `${DEMO_PREFIX}rationale:1`,
      candidateId: `${DEMO_PREFIX}cand:1`,
      title: "Tighten S3 public-access posture across prod",
      outcome: "approval_packet_prepared",
      boundaryClass: "approval_required",
      haltedAtStage: null,
      haltReason: null,
      rootCause: "Two prod buckets reverted PAB during a recent IaC drift.",
      minutesAgo: 3,
    },
    {
      id: `${DEMO_PREFIX}rationale:2`,
      candidateId: `${DEMO_PREFIX}cand:2`,
      title: "Re-enable CloudTrail logging in eu-west-1",
      outcome: "verified_complete",
      boundaryClass: "readonly_allowed",
      haltedAtStage: null,
      haltReason: null,
      rootCause: "Region-specific trail was stopped during failover testing.",
      minutesAgo: 22,
    },
    {
      id: `${DEMO_PREFIX}rationale:3`,
      candidateId: `${DEMO_PREFIX}cand:3`,
      title: "Remove 0.0.0.0/0 SSH on dev-bastion-3",
      outcome: "halted_at_gate",
      boundaryClass: "approval_required",
      haltedAtStage: "policy_gate",
      haltReason: "Charter mode is observer — operator must approve.",
      rootCause: "AuthorizeSecurityGroupIngress added by an unknown principal.",
      minutesAgo: 45,
    },
    {
      id: `${DEMO_PREFIX}rationale:4`,
      candidateId: `${DEMO_PREFIX}cand:4`,
      title: "Rotate aged KMS key axiom-prod-data",
      outcome: "approval_packet_prepared",
      boundaryClass: "approval_required",
      haltedAtStage: null,
      haltReason: null,
      rootCause: "Key has no rotation policy + last rotation > 1 year ago.",
      minutesAgo: 80,
    },
    {
      id: `${DEMO_PREFIX}rationale:5`,
      candidateId: `${DEMO_PREFIX}cand:5`,
      title: "Reduce idle NAT gateway in us-east-2",
      outcome: "deferred_to_human",
      boundaryClass: "preview_allowed",
      haltedAtStage: null,
      haltReason: null,
      rootCause: "Cost anomaly: $138/mo NAT gateway with <1MB/day traffic.",
      minutesAgo: 110,
    },
    {
      id: `${DEMO_PREFIX}rationale:6`,
      candidateId: `${DEMO_PREFIX}cand:6`,
      title: "Investigate Azure Sev0 alert (storage public access)",
      outcome: "halted_at_gate",
      boundaryClass: "approval_required",
      haltedAtStage: "boundary",
      haltReason: "Boundary class requires approval; alert lacks runbook recipe.",
      rootCause: "AzureMonitor Sev0: storage account 'audit-logs-prod' became Public.",
      minutesAgo: 7,
    },
  ];

  for (const s of rationaleSeeds) {
    try {
      await prisma.autonomyDecisionRationale.upsert({
        where: { id: s.id },
        update: {},
        create: {
          id: s.id,
          organizationId: opts.organizationId,
          cycleId: `${DEMO_PREFIX}cycle:current`,
          candidateId: s.candidateId,
          title: s.title,
          charterMode: "review",
          boundaryClass: s.boundaryClass,
          outcome: s.outcome,
          haltedAtStage: s.haltedAtStage,
          haltReason: s.haltReason,
          proposedIntent: s.title,
          stages: [
            { stage: "detect", status: "passed", summary: "Signal detected", evidenceRef: `${DEMO_PREFIX}ev:${s.candidateId}` },
            { stage: "reason", status: "passed", summary: s.rootCause, evidenceRef: `${DEMO_PREFIX}ev:${s.candidateId}:reason` },
            { stage: "policy_gate", status: s.haltedAtStage === "policy_gate" ? "halted_policy" : "passed", summary: s.haltedAtStage === "policy_gate" ? s.haltReason! : "Policy gate passed", evidenceRef: `${DEMO_PREFIX}ev:${s.candidateId}:policy` },
          ] as unknown as object,
          evidenceRefs: [`${DEMO_PREFIX}ev:${s.candidateId}`],
          durationMs: 240 + Math.floor(Math.random() * 800),
          createdAt: minutesAgo(s.minutesAgo),
        },
      });
      out.rationaleRows++;
    } catch (err) {
      out.errors.push(`rationale ${s.id}: ${err instanceof Error ? err.message.slice(0, 120) : "unknown"}`);
    }
  }

  // Staged runbook rows.
  const runbookSeeds = [
    { id: `${DEMO_PREFIX}rb:1`, eventName: "PutBucketPublicAccessBlock", severity: "high", status: "staged" },
    { id: `${DEMO_PREFIX}rb:2`, eventName: "AuthorizeSecurityGroupIngress", severity: "critical", status: "staged" },
    { id: `${DEMO_PREFIX}rb:3`, eventName: "DisableKey", severity: "high", status: "approved" },
    { id: `${DEMO_PREFIX}rb:4`, eventName: "DeleteTrail", severity: "critical", status: "rejected" },
  ];
  for (const s of runbookSeeds) {
    try {
      await prisma.stagedRemediationRunbook.upsert({
        where: { id: s.id },
        update: {},
        create: {
          id: s.id,
          organizationId: opts.organizationId,
          runbookId: `${DEMO_PREFIX}runbook:${s.eventName}`,
          sourceEventId: `${DEMO_PREFIX}cloudtrail:${s.eventName}`,
          eventName: s.eventName,
          severity: s.severity,
          rootCause: `Demo event ${s.eventName} on prospect-demo tenant`,
          affectedResource: s.eventName.includes("Bucket") ? "s3.amazonaws.com" : "ec2.amazonaws.com",
          reversalLabel: `Reverse ${s.eventName}`,
          reversalRisk: "safe_revert",
          reversalApi: null,
          hardeningLabel: `Add guardrail for ${s.eventName}`,
          hardeningApi: null,
          confidence: 0.88,
          evidenceRefs: [`${DEMO_PREFIX}ev:rb:${s.eventName}`],
          status: s.status,
          decision: s.status === "staged" ? null : s.status === "approved" ? "approve" : "reject",
          stagedBy: "demo@axiom.dev",
          decidedAt: s.status === "staged" ? null : minutesAgo(15),
          decidedBy: s.status === "staged" ? null : "demo@axiom.dev",
        },
      });
      out.runbookRows++;
    } catch (err) {
      out.errors.push(`runbook ${s.id}: ${err instanceof Error ? err.message.slice(0, 120) : "unknown"}`);
    }
  }

  // Outbound notification record rows (no Slack send — pure DB).
  const notifSeeds = [
    { id: `${DEMO_PREFIX}notif:1`, kind: "critical_telemetry_signal", severity: "critical", outcome: "ok" },
    { id: `${DEMO_PREFIX}notif:2`, kind: "approval_packet_ready", severity: "high", outcome: "ok" },
    { id: `${DEMO_PREFIX}notif:3`, kind: "autonomy_halt_needs_human", severity: "high", outcome: "deduped" },
    { id: `${DEMO_PREFIX}notif:4`, kind: "cycle_summary", severity: "info", outcome: "ok" },
  ];
  for (const s of notifSeeds) {
    try {
      await prisma.outboundNotificationRecord.upsert({
        where: { id: s.id },
        update: {},
        create: {
          id: s.id,
          organizationId: opts.organizationId,
          dedupeKey: `${DEMO_PREFIX}dedupe:${s.id}`,
          kind: s.kind,
          severity: s.severity,
          headline: `Demo: ${s.kind.replace(/_/g, " ")}`,
          body: "Sample notification used for the demo dashboard.",
          outcome: s.outcome,
          channelsSucceeded: s.outcome === "ok" ? ["slack"] : [],
          channelsSkipped: s.outcome === "deduped" ? ["slack:deduped"] : [],
          evidenceRefs: [`${DEMO_PREFIX}ev:notif:${s.id}`],
          correlationId: null,
        },
      });
      out.notificationRows++;
    } catch (err) {
      out.errors.push(`notif ${s.id}: ${err instanceof Error ? err.message.slice(0, 120) : "unknown"}`);
    }
  }

  // Feedback rows.
  const feedbackSeeds = [
    { id: `${DEMO_PREFIX}fb:1`, sentiment: "happy", message: "The runbook queue + Slack ping closed our loop." },
    { id: `${DEMO_PREFIX}fb:2`, sentiment: "neutral", message: "Need a Helm-chart deployer for clusters." },
    { id: `${DEMO_PREFIX}fb:3`, sentiment: "frustrated", message: "Cost Explorer activation flow is confusing." },
  ];
  for (const s of feedbackSeeds) {
    try {
      await prisma.feedbackRecord.upsert({
        where: { id: s.id },
        update: {},
        create: {
          id: s.id,
          organizationId: opts.organizationId,
          email: "demo@axiom.dev",
          sentiment: s.sentiment,
          pagePath: "/dashboard/command-center",
          message: s.message,
          userAgent: "demo-populator",
        },
      });
      out.feedbackRows++;
    } catch (err) {
      out.errors.push(`feedback ${s.id}: ${err instanceof Error ? err.message.slice(0, 120) : "unknown"}`);
    }
  }

  // Help query analytics — surfaces top-no-match insight in the demo.
  const helpSeeds = [
    { id: `${DEMO_PREFIX}help:1`, query: "cloudtrail audit tail", verdict: "found_primary", primary: "cloudtrail", score: 0.92 },
    { id: `${DEMO_PREFIX}help:2`, query: "how to disable autonomy", verdict: "no_match", primary: null, score: 0.12 },
    { id: `${DEMO_PREFIX}help:3`, query: "vault rotation policy", verdict: "no_match", primary: null, score: 0.08 },
    { id: `${DEMO_PREFIX}help:4`, query: "runbook queue", verdict: "found_primary", primary: "runbook-queue", score: 0.85 },
  ];
  for (const s of helpSeeds) {
    try {
      await prisma.helpQueryRecord.upsert({
        where: { id: s.id },
        update: {},
        create: {
          id: s.id,
          organizationId: opts.organizationId,
          query: s.query,
          totalTokens: s.query.split(/\W+/).length,
          verdict: s.verdict,
          primaryEntryId: s.primary,
          topHitScore: s.score,
        },
      });
      out.helpQueryRows++;
    } catch (err) {
      out.errors.push(`help ${s.id}: ${err instanceof Error ? err.message.slice(0, 120) : "unknown"}`);
    }
  }

  return out;
}

export interface DemoCleanupOutcome {
  rationaleDeleted: number;
  runbookDeleted: number;
  notificationDeleted: number;
  feedbackDeleted: number;
  helpQueryDeleted: number;
  errors: string[];
}

export async function cleanupDemoData(opts: { organizationId: string }): Promise<DemoCleanupOutcome> {
  const result: DemoCleanupOutcome = {
    rationaleDeleted: 0,
    runbookDeleted: 0,
    notificationDeleted: 0,
    feedbackDeleted: 0,
    helpQueryDeleted: 0,
    errors: [],
  };
  const idStartsWith = { startsWith: DEMO_PREFIX };
  try {
    const r = await prisma.autonomyDecisionRationale.deleteMany({
      where: { organizationId: opts.organizationId, id: idStartsWith },
    });
    result.rationaleDeleted = r.count;
  } catch (err) {
    result.errors.push(`rationale: ${err instanceof Error ? err.message : "unknown"}`);
  }
  try {
    const r = await prisma.stagedRemediationRunbook.deleteMany({
      where: { organizationId: opts.organizationId, id: idStartsWith },
    });
    result.runbookDeleted = r.count;
  } catch (err) {
    result.errors.push(`runbook: ${err instanceof Error ? err.message : "unknown"}`);
  }
  try {
    const r = await prisma.outboundNotificationRecord.deleteMany({
      where: { organizationId: opts.organizationId, id: idStartsWith },
    });
    result.notificationDeleted = r.count;
  } catch (err) {
    result.errors.push(`notif: ${err instanceof Error ? err.message : "unknown"}`);
  }
  try {
    const r = await prisma.feedbackRecord.deleteMany({
      where: { organizationId: opts.organizationId, id: idStartsWith },
    });
    result.feedbackDeleted = r.count;
  } catch (err) {
    result.errors.push(`feedback: ${err instanceof Error ? err.message : "unknown"}`);
  }
  try {
    const r = await prisma.helpQueryRecord.deleteMany({
      where: { organizationId: opts.organizationId, id: idStartsWith },
    });
    result.helpQueryDeleted = r.count;
  } catch (err) {
    result.errors.push(`help: ${err instanceof Error ? err.message : "unknown"}`);
  }
  return result;
}

export const DEMO_ROW_PREFIX = DEMO_PREFIX;
