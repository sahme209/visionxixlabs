import { prisma } from "@/lib/db";
import type { ScanDiff, DiffFinding } from "./types";

// ---------------------------------------------------------------------------
// diffRuns — compares two agent runs and returns structured changes
// ---------------------------------------------------------------------------

export async function diffRuns(
  currentRunId: string,
  previousRunId: string,
): Promise<ScanDiff> {
  const [current, previous] = await Promise.all([
    loadRunFindings(currentRunId),
    loadRunFindings(previousRunId),
  ]);

  const newFindings = current.findings.filter(
    (f) => !previous.findings.some((pf) => isSameFinding(f, pf)),
  );
  const resolvedFindings = previous.findings.filter(
    (f) => !current.findings.some((cf) => isSameFinding(f, cf)),
  );

  const newHighRiskCount = newFindings.filter(
    (f) => f.severity === "high" || f.severity === "critical",
  ).length;

  const currentSavingsLow = current.findings.reduce((s, f) => s + f.yearlyLow, 0);
  const currentSavingsHigh = current.findings.reduce((s, f) => s + f.yearlyHigh, 0);
  const prevSavingsLow = previous.findings.reduce((s, f) => s + f.yearlyLow, 0);
  const prevSavingsHigh = previous.findings.reduce((s, f) => s + f.yearlyHigh, 0);

  const savingsDelta = {
    low: currentSavingsLow - prevSavingsLow,
    high: currentSavingsHigh - prevSavingsHigh,
  };

  const resourceCountDelta = current.resourceCount - previous.resourceCount;
  const findingCountDelta = current.findings.length - previous.findings.length;

  const isSignificant =
    newHighRiskCount > 0 ||
    resolvedFindings.length > 0 ||
    Math.abs(savingsDelta.high) > 100 ||
    Math.abs(resourceCountDelta) > 0;

  const summary = buildSummary(
    newFindings.length,
    resolvedFindings.length,
    newHighRiskCount,
    savingsDelta,
    resourceCountDelta,
  );

  return {
    currentRunId,
    previousRunId,
    newFindings: newFindings.map(toDiffFinding),
    resolvedFindings: resolvedFindings.map(toDiffFinding),
    newHighRiskCount,
    savingsDelta,
    resourceCountDelta,
    findingCountDelta,
    isSignificant,
    summary,
  };
}

// ---------------------------------------------------------------------------
// DB loader
// ---------------------------------------------------------------------------

type RunData = {
  findings: Array<{
    title: string;
    severity: string;
    region: string;
    category: string;
    affectedResources: unknown;
    yearlyLow: number;
    yearlyHigh: number;
  }>;
  resourceCount: number;
};

async function loadRunFindings(runId: string): Promise<RunData> {
  const run = await prisma.axiomAgentRun.findUniqueOrThrow({
    where: { id: runId },
    select: {
      snapshotData: true,
      findings: {
        select: {
          title: true,
          severity: true,
          region: true,
          category: true,
          affectedResources: true,
          yearlyLow: true,
          yearlyHigh: true,
        },
      },
    },
  });

  const snapshot = run.snapshotData as Record<string, unknown> | null;
  const resources = Array.isArray(snapshot?.resources) ? snapshot.resources as unknown[] : [];

  return {
    findings: run.findings,
    resourceCount: resources.length,
  };
}

// ---------------------------------------------------------------------------
// Matching — two findings are "the same" if title + region match
// ---------------------------------------------------------------------------

function isSameFinding(
  a: { title: string; region: string },
  b: { title: string; region: string },
): boolean {
  return a.title === b.title && a.region === b.region;
}

function toDiffFinding(f: {
  title: string;
  severity: string;
  region: string;
  yearlyHigh: number;
}): DiffFinding {
  return { title: f.title, severity: f.severity, region: f.region, yearlyHigh: f.yearlyHigh };
}

// ---------------------------------------------------------------------------
// Summary builder — one-sentence human-readable diff
// ---------------------------------------------------------------------------

function buildSummary(
  newCount: number,
  resolvedCount: number,
  newHighRiskCount: number,
  savingsDelta: { low: number; high: number },
  resourceCountDelta: number,
): string {
  const parts: string[] = [];

  if (newHighRiskCount > 0) {
    parts.push(`${newHighRiskCount} new high-risk issue${newHighRiskCount !== 1 ? "s" : ""}`);
  } else if (newCount > 0) {
    parts.push(`${newCount} new finding${newCount !== 1 ? "s" : ""}`);
  }

  if (resolvedCount > 0) {
    parts.push(`${resolvedCount} resolved`);
  }

  if (savingsDelta.high > 0) {
    parts.push(`$${savingsDelta.high.toLocaleString()}/year more savings identified`);
  } else if (savingsDelta.high < 0) {
    parts.push(`$${Math.abs(savingsDelta.high).toLocaleString()}/year less savings (improvements applied)`);
  }

  if (Math.abs(resourceCountDelta) > 0) {
    const dir = resourceCountDelta > 0 ? "more" : "fewer";
    parts.push(`${Math.abs(resourceCountDelta)} ${dir} resource${Math.abs(resourceCountDelta) !== 1 ? "s" : ""}`);
  }

  if (parts.length === 0) {
    return "No significant changes since the last scan.";
  }

  return `Since the last scan, I found ${parts.join(" and ")}.`;
}
