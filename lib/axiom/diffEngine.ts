import { prisma } from "@/lib/db";
import type {
  CloudSnapshot,
  CloudResource,
  ComputeResource,
  StorageResource,
  CloudProvider,
} from "./cloudSnapshot";

// ---------------------------------------------------------------------------
// Diff result — the full structured comparison between two agent runs
// ---------------------------------------------------------------------------

export type AgentRunDiff = {
  previousRunId: string;
  currentRunId: string;
  provider: CloudProvider;
  scannedAt: { previous: string; current: string };

  resources: ResourceDiff;
  findings: FindingDiff;
  savings: SavingsDiff;

  summary: string;
  isSignificant: boolean;
  changeCount: number;
};

// ---------------------------------------------------------------------------
// Resource-level diff
// ---------------------------------------------------------------------------

export type ResourceChange = {
  resourceId: string;
  resourceType: "compute" | "storage";
  region: string;
  detail: string;
};

export type InstanceTypeChange = {
  resourceId: string;
  region: string;
  previousType: string;
  currentType: string;
};

export type RegionChange = {
  resourceId: string;
  resourceType: "compute" | "storage";
  previousRegion: string;
  currentRegion: string;
};

export type ResourceDiff = {
  newResources: ResourceChange[];
  deletedResources: ResourceChange[];
  changedInstanceType: InstanceTypeChange[];
  changedRegion: RegionChange[];
  previousTotal: number;
  currentTotal: number;
};

// ---------------------------------------------------------------------------
// Finding-level diff
// ---------------------------------------------------------------------------

export type FindingChange = {
  title: string;
  category: string;
  severity: string;
  region: string;
  yearlySavings: number;
};

export type RiskChange = {
  title: string;
  region: string;
  previousSeverity: string;
  currentSeverity: string;
  direction: "worsened" | "improved";
};

export type FindingDiff = {
  newFindings: FindingChange[];
  resolvedFindings: FindingChange[];
  worsenedRisk: RiskChange[];
  improvedRisk: RiskChange[];
  previousCount: number;
  currentCount: number;
};

// ---------------------------------------------------------------------------
// Savings diff
// ---------------------------------------------------------------------------

export type CostOpportunity = {
  title: string;
  region: string;
  yearlyHigh: number;
  isNew: boolean;
};

export type SavingsDiff = {
  previousYearlyLow: number;
  previousYearlyHigh: number;
  currentYearlyLow: number;
  currentYearlyHigh: number;
  deltaYearlyLow: number;
  deltaYearlyHigh: number;
  newCostOpportunities: CostOpportunity[];
};

// ---------------------------------------------------------------------------
// compareAgentRuns — loads two runs from DB and returns a full structured diff
// ---------------------------------------------------------------------------

export async function compareAgentRuns(
  previousRunId: string,
  currentRunId: string,
): Promise<AgentRunDiff> {
  const [previousRun, currentRun] = await Promise.all([
    loadRunData(previousRunId),
    loadRunData(currentRunId),
  ]);

  const previousSnapshot = previousRun.snapshot;
  const currentSnapshot = currentRun.snapshot;

  const resources = diffResources(
    previousSnapshot?.resources ?? [],
    currentSnapshot?.resources ?? [],
  );

  const findings = diffFindings(previousRun.findings, currentRun.findings);

  const savings = diffSavings(previousRun.findings, currentRun.findings);

  const changeCount =
    resources.newResources.length +
    resources.deletedResources.length +
    resources.changedInstanceType.length +
    resources.changedRegion.length +
    findings.newFindings.length +
    findings.resolvedFindings.length +
    findings.worsenedRisk.length +
    findings.improvedRisk.length +
    savings.newCostOpportunities.length;

  const isSignificant =
    findings.worsenedRisk.length > 0 ||
    findings.newFindings.some((f) => f.severity === "high" || f.severity === "critical") ||
    findings.resolvedFindings.length > 0 ||
    Math.abs(savings.deltaYearlyHigh) > 100 ||
    resources.newResources.length > 0 ||
    resources.deletedResources.length > 0;

  const summary = buildSummary(resources, findings, savings);

  return {
    previousRunId,
    currentRunId,
    provider: currentSnapshot?.provider ?? previousSnapshot?.provider ?? "aws",
    scannedAt: {
      previous: previousSnapshot?.scannedAt ?? previousRun.createdAt,
      current: currentSnapshot?.scannedAt ?? currentRun.createdAt,
    },
    resources,
    findings,
    savings,
    summary,
    isSignificant,
    changeCount,
  };
}

// ---------------------------------------------------------------------------
// Pure comparison functions — no DB dependency, fully testable
// ---------------------------------------------------------------------------

export function diffResources(
  previous: CloudResource[],
  current: CloudResource[],
): ResourceDiff {
  const prevMap = new Map(previous.map((r) => [r.resourceId, r]));
  const currMap = new Map(current.map((r) => [r.resourceId, r]));

  const newResources: ResourceChange[] = [];
  const deletedResources: ResourceChange[] = [];
  const changedInstanceType: InstanceTypeChange[] = [];
  const changedRegion: RegionChange[] = [];

  // New resources: in current but not in previous
  for (const [id, res] of currMap) {
    if (!prevMap.has(id)) {
      newResources.push({
        resourceId: id,
        resourceType: res.resourceType,
        region: res.region,
        detail: resourceDetail(res),
      });
    }
  }

  // Deleted resources: in previous but not in current
  for (const [id, res] of prevMap) {
    if (!currMap.has(id)) {
      deletedResources.push({
        resourceId: id,
        resourceType: res.resourceType,
        region: res.region,
        detail: resourceDetail(res),
      });
    }
  }

  // Changed resources: in both, check for instance type and region changes
  for (const [id, curr] of currMap) {
    const prev = prevMap.get(id);
    if (!prev) continue;

    if (prev.region !== curr.region) {
      changedRegion.push({
        resourceId: id,
        resourceType: curr.resourceType,
        previousRegion: prev.region,
        currentRegion: curr.region,
      });
    }

    if (prev.resourceType === "compute" && curr.resourceType === "compute") {
      const prevCompute = prev as ComputeResource;
      const currCompute = curr as ComputeResource;
      if (prevCompute.instanceType !== currCompute.instanceType) {
        changedInstanceType.push({
          resourceId: id,
          region: curr.region,
          previousType: prevCompute.instanceType,
          currentType: currCompute.instanceType,
        });
      }
    }
  }

  return {
    newResources,
    deletedResources,
    changedInstanceType,
    changedRegion,
    previousTotal: previous.length,
    currentTotal: current.length,
  };
}

export function diffFindings(
  previous: FindingRow[],
  current: FindingRow[],
): FindingDiff {
  const prevByKey = new Map(previous.map((f) => [findingKey(f), f]));
  const currByKey = new Map(current.map((f) => [findingKey(f), f]));

  const newFindings: FindingChange[] = [];
  const resolvedFindings: FindingChange[] = [];
  const worsenedRisk: RiskChange[] = [];
  const improvedRisk: RiskChange[] = [];

  // New findings
  for (const [key, f] of currByKey) {
    if (!prevByKey.has(key)) {
      newFindings.push({
        title: f.title,
        category: f.category,
        severity: f.severity,
        region: f.region,
        yearlySavings: f.yearlyHigh,
      });
    }
  }

  // Resolved findings
  for (const [key, f] of prevByKey) {
    if (!currByKey.has(key)) {
      resolvedFindings.push({
        title: f.title,
        category: f.category,
        severity: f.severity,
        region: f.region,
        yearlySavings: f.yearlyHigh,
      });
    }
  }

  // Severity changes on persistent findings
  for (const [key, curr] of currByKey) {
    const prev = prevByKey.get(key);
    if (!prev) continue;

    const prevRank = SEVERITY_RANK[prev.severity] ?? 0;
    const currRank = SEVERITY_RANK[curr.severity] ?? 0;

    if (currRank > prevRank) {
      worsenedRisk.push({
        title: curr.title,
        region: curr.region,
        previousSeverity: prev.severity,
        currentSeverity: curr.severity,
        direction: "worsened",
      });
    } else if (currRank < prevRank) {
      improvedRisk.push({
        title: curr.title,
        region: curr.region,
        previousSeverity: prev.severity,
        currentSeverity: curr.severity,
        direction: "improved",
      });
    }
  }

  return {
    newFindings,
    resolvedFindings,
    worsenedRisk,
    improvedRisk,
    previousCount: previous.length,
    currentCount: current.length,
  };
}

export function diffSavings(
  previous: FindingRow[],
  current: FindingRow[],
): SavingsDiff {
  const prevByKey = new Map(previous.map((f) => [findingKey(f), f]));

  const previousYearlyLow = previous.reduce((s, f) => s + f.yearlyLow, 0);
  const previousYearlyHigh = previous.reduce((s, f) => s + f.yearlyHigh, 0);
  const currentYearlyLow = current.reduce((s, f) => s + f.yearlyLow, 0);
  const currentYearlyHigh = current.reduce((s, f) => s + f.yearlyHigh, 0);

  const newCostOpportunities: CostOpportunity[] = current
    .filter((f) => f.yearlyHigh > 0)
    .map((f) => ({
      title: f.title,
      region: f.region,
      yearlyHigh: f.yearlyHigh,
      isNew: !prevByKey.has(findingKey(f)),
    }))
    .filter((opp) => opp.isNew);

  return {
    previousYearlyLow,
    previousYearlyHigh,
    currentYearlyLow,
    currentYearlyHigh,
    deltaYearlyLow: currentYearlyLow - previousYearlyLow,
    deltaYearlyHigh: currentYearlyHigh - previousYearlyHigh,
    newCostOpportunities,
  };
}

// ---------------------------------------------------------------------------
// Human-readable summary builder
// ---------------------------------------------------------------------------

export function buildSummary(
  resources: ResourceDiff,
  findings: FindingDiff,
  savings: SavingsDiff,
): string {
  const parts: string[] = [];

  // Resource changes
  if (resources.newResources.length > 0) {
    const types = countByType(resources.newResources);
    parts.push(formatResourceChanges(types, "new"));
  }

  if (resources.deletedResources.length > 0) {
    const types = countByType(resources.deletedResources);
    parts.push(formatResourceChanges(types, "removed"));
  }

  if (resources.changedInstanceType.length > 0) {
    const n = resources.changedInstanceType.length;
    parts.push(`${n} instance${n !== 1 ? "s" : ""} changed type`);
  }

  // Finding changes
  if (findings.worsenedRisk.length > 0) {
    const n = findings.worsenedRisk.length;
    parts.push(`${n} finding${n !== 1 ? "s" : ""} worsened in severity`);
  }

  if (findings.improvedRisk.length > 0) {
    const n = findings.improvedRisk.length;
    parts.push(`${n} finding${n !== 1 ? "s" : ""} improved in severity`);
  }

  if (findings.resolvedFindings.length > 0) {
    const n = findings.resolvedFindings.length;
    parts.push(`${n} finding${n !== 1 ? "s" : ""} resolved`);
  }

  if (findings.newFindings.length > 0) {
    const n = findings.newFindings.length;
    const highRisk = findings.newFindings.filter(
      (f) => f.severity === "high" || f.severity === "critical",
    ).length;
    if (highRisk > 0) {
      parts.push(`${n} new finding${n !== 1 ? "s" : ""} (${highRisk} high-risk)`);
    } else {
      parts.push(`${n} new finding${n !== 1 ? "s" : ""}`);
    }
  }

  // Savings changes
  if (savings.newCostOpportunities.length > 0) {
    const n = savings.newCostOpportunities.length;
    const total = savings.newCostOpportunities.reduce((s, o) => s + o.yearlyHigh, 0);
    parts.push(`${n} new cost opportunit${n !== 1 ? "ies" : "y"} worth ~$${Math.round(total).toLocaleString()}/yr`);
  } else if (savings.deltaYearlyHigh > 100) {
    parts.push(`estimated savings increased by $${Math.round(savings.deltaYearlyHigh).toLocaleString()}/yr`);
  } else if (savings.deltaYearlyHigh < -100) {
    parts.push(`estimated savings decreased by $${Math.round(Math.abs(savings.deltaYearlyHigh)).toLocaleString()}/yr (likely from applied fixes)`);
  }

  if (parts.length === 0) {
    return "No significant changes since the last scan.";
  }

  return `Since the last scan, ${joinWithCommaAnd(parts)}.`;
}

// ---------------------------------------------------------------------------
// DB loader
// ---------------------------------------------------------------------------

type FindingRow = {
  title: string;
  severity: string;
  region: string;
  category: string;
  affectedResources: unknown;
  yearlyLow: number;
  yearlyHigh: number;
};

type RunData = {
  snapshot: CloudSnapshot | null;
  findings: FindingRow[];
  createdAt: string;
};

async function loadRunData(runId: string): Promise<RunData> {
  const run = await prisma.axiomAgentRun.findUniqueOrThrow({
    where: { id: runId },
    select: {
      snapshotData: true,
      createdAt: true,
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

  const snapshot = run.snapshotData as unknown as CloudSnapshot | null;

  return {
    snapshot,
    findings: run.findings,
    createdAt: run.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SEVERITY_RANK: Record<string, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function findingKey(f: { title: string; region: string }): string {
  return `${f.title}::${f.region}`;
}

function resourceDetail(r: CloudResource): string {
  if (r.resourceType === "compute") {
    const c = r as ComputeResource;
    return `${c.instanceType} (${c.state})`;
  }
  const s = r as StorageResource;
  return `${s.storageClass}${s.sizeGb != null ? `, ${s.sizeGb} GB` : ""}`;
}

function countByType(changes: ResourceChange[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const c of changes) {
    const label = c.resourceType === "compute" ? "instance" : "bucket";
    counts[label] = (counts[label] ?? 0) + 1;
  }
  return counts;
}

function formatResourceChanges(counts: Record<string, number>, verb: string): string {
  const segments = Object.entries(counts).map(([type, n]) => {
    const plural = n !== 1 ? (type === "instance" ? "instances" : "buckets") : type;
    return `${n} ${verb} ${plural}`;
  });
  return segments.join(" and ");
}

function joinWithCommaAnd(parts: string[]): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}
