/**
 * Multi-Cloud Resilience Score — 100-point scoring model.
 * 5 categories, 20 points each. Deterministic, explainable.
 */

export interface ResilienceScoreInput {
  providers: string[];
  regions: string[];
  hasBackups: boolean;
  hasCrossRegionReplication: boolean;
  hasCrossCloudReplication: boolean;
  securityFindings: { severity: "critical" | "high" | "medium" | "low" }[];
  hasMonitoring: boolean;
  hasAlerts: boolean;
  hasIncidentRunbooks: boolean;
  hasAutoScaling: boolean;
  hasDRPlan: boolean;
}

export interface ResilienceScoreResult {
  total: number;
  categories: {
    cloudDependency: CategoryScore;
    regionalRedundancy: CategoryScore;
    backupAndReplication: CategoryScore;
    securityExposure: CategoryScore;
    monitoringAndRecovery: CategoryScore;
  };
  grade: "A" | "B" | "C" | "D" | "F";
  summary: string;
}

export interface CategoryScore {
  score: number;
  maxScore: number;
  factors: { name: string; points: number; reason: string }[];
}

export function computeResilienceScore(input: ResilienceScoreInput): ResilienceScoreResult {
  const cloudDependency = scoreCloudDependency(input);
  const regionalRedundancy = scoreRegionalRedundancy(input);
  const backupAndReplication = scoreBackupAndReplication(input);
  const securityExposure = scoreSecurityExposure(input);
  const monitoringAndRecovery = scoreMonitoringAndRecovery(input);

  const total =
    cloudDependency.score +
    regionalRedundancy.score +
    backupAndReplication.score +
    securityExposure.score +
    monitoringAndRecovery.score;

  const grade = total >= 80 ? "A" : total >= 65 ? "B" : total >= 50 ? "C" : total >= 35 ? "D" : "F";

  const summary = buildSummary(total, grade, input);

  return {
    total,
    categories: {
      cloudDependency,
      regionalRedundancy,
      backupAndReplication,
      securityExposure,
      monitoringAndRecovery,
    },
    grade,
    summary,
  };
}

function scoreCloudDependency(input: ResilienceScoreInput): CategoryScore {
  const factors: CategoryScore["factors"] = [];
  let score = 0;

  const providerCount = input.providers.length;
  if (providerCount >= 3) {
    factors.push({ name: "Multi-cloud (3+)", points: 20, reason: "Infrastructure spans 3+ cloud providers" });
    score = 20;
  } else if (providerCount === 2) {
    factors.push({ name: "Dual-cloud", points: 14, reason: "Infrastructure spans 2 cloud providers" });
    score = 14;
  } else if (providerCount === 1) {
    factors.push({ name: "Single-cloud", points: 4, reason: "All infrastructure on one provider — high vendor lock-in risk" });
    score = 4;
  } else {
    factors.push({ name: "No cloud connected", points: 0, reason: "No cloud providers connected" });
    score = 0;
  }

  return { score, maxScore: 20, factors };
}

function scoreRegionalRedundancy(input: ResilienceScoreInput): CategoryScore {
  const factors: CategoryScore["factors"] = [];
  let score = 0;

  const regionCount = input.regions.length;
  if (regionCount >= 3) {
    factors.push({ name: "Multi-region (3+)", points: 15, reason: "Resources distributed across 3+ regions" });
    score += 15;
  } else if (regionCount === 2) {
    factors.push({ name: "Dual-region", points: 10, reason: "Resources in 2 regions" });
    score += 10;
  } else {
    factors.push({ name: "Single-region", points: 3, reason: "All resources in one region — single point of failure" });
    score += 3;
  }

  if (input.hasAutoScaling) {
    factors.push({ name: "Auto-scaling", points: 5, reason: "Auto-scaling configured for demand spikes" });
    score += 5;
  } else {
    factors.push({ name: "No auto-scaling", points: 0, reason: "No auto-scaling — manual intervention needed for load" });
  }

  return { score: Math.min(score, 20), maxScore: 20, factors };
}

function scoreBackupAndReplication(input: ResilienceScoreInput): CategoryScore {
  const factors: CategoryScore["factors"] = [];
  let score = 0;

  if (input.hasBackups) {
    factors.push({ name: "Backups configured", points: 8, reason: "Regular backups are in place" });
    score += 8;
  } else {
    factors.push({ name: "No backups", points: 0, reason: "No backup strategy detected" });
  }

  if (input.hasCrossRegionReplication) {
    factors.push({ name: "Cross-region replication", points: 6, reason: "Data replicated across regions" });
    score += 6;
  } else {
    factors.push({ name: "No cross-region replication", points: 0, reason: "Data exists in one region only" });
  }

  if (input.hasCrossCloudReplication) {
    factors.push({ name: "Cross-cloud replication", points: 6, reason: "Data replicated to secondary cloud" });
    score += 6;
  } else {
    factors.push({ name: "No cross-cloud replication", points: 0, reason: "No data replication across providers" });
  }

  return { score: Math.min(score, 20), maxScore: 20, factors };
}

function scoreSecurityExposure(input: ResilienceScoreInput): CategoryScore {
  const factors: CategoryScore["factors"] = [];

  const criticalCount = input.securityFindings.filter((f) => f.severity === "critical").length;
  const highCount = input.securityFindings.filter((f) => f.severity === "high").length;
  const mediumCount = input.securityFindings.filter((f) => f.severity === "medium").length;

  let score = 20;

  if (criticalCount > 0) {
    const deduction = Math.min(criticalCount * 6, 12);
    score -= deduction;
    factors.push({ name: "Critical findings", points: -deduction, reason: `${criticalCount} critical security finding(s)` });
  }
  if (highCount > 0) {
    const deduction = Math.min(highCount * 3, 6);
    score -= deduction;
    factors.push({ name: "High findings", points: -deduction, reason: `${highCount} high severity finding(s)` });
  }
  if (mediumCount > 0) {
    const deduction = Math.min(mediumCount * 1, 3);
    score -= deduction;
    factors.push({ name: "Medium findings", points: -deduction, reason: `${mediumCount} medium severity finding(s)` });
  }

  if (criticalCount === 0 && highCount === 0 && mediumCount === 0) {
    factors.push({ name: "Clean security posture", points: 0, reason: "No security findings detected" });
  }

  score = Math.max(score, 0);
  return { score, maxScore: 20, factors };
}

function scoreMonitoringAndRecovery(input: ResilienceScoreInput): CategoryScore {
  const factors: CategoryScore["factors"] = [];
  let score = 0;

  if (input.hasMonitoring) {
    factors.push({ name: "Monitoring active", points: 5, reason: "Infrastructure monitoring in place" });
    score += 5;
  } else {
    factors.push({ name: "No monitoring", points: 0, reason: "No infrastructure monitoring detected" });
  }

  if (input.hasAlerts) {
    factors.push({ name: "Alerts configured", points: 5, reason: "Alert rules configured for incidents" });
    score += 5;
  } else {
    factors.push({ name: "No alerts", points: 0, reason: "No alerting rules — incidents go unnoticed" });
  }

  if (input.hasIncidentRunbooks) {
    factors.push({ name: "Incident runbooks", points: 5, reason: "Runbooks documented for incident response" });
    score += 5;
  } else {
    factors.push({ name: "No runbooks", points: 0, reason: "No incident response documentation" });
  }

  if (input.hasDRPlan) {
    factors.push({ name: "DR plan", points: 5, reason: "Disaster recovery plan documented" });
    score += 5;
  } else {
    factors.push({ name: "No DR plan", points: 0, reason: "No disaster recovery plan — recovery is ad hoc" });
  }

  return { score: Math.min(score, 20), maxScore: 20, factors };
}

function buildSummary(total: number, grade: string, input: ResilienceScoreInput): string {
  const provider = input.providers[0] ?? "unknown";
  if (total >= 80) {
    return `Strong multi-cloud posture. Your infrastructure is well-distributed and resilient.`;
  }
  if (total >= 65) {
    return `Good foundation but gaps exist. You have some redundancy but could improve backup and monitoring.`;
  }
  if (total >= 50) {
    return `Moderate risk. Your infrastructure has single points of failure that should be addressed.`;
  }
  if (total >= 35) {
    return `High risk. Heavy dependency on ${provider} with limited redundancy or recovery capabilities.`;
  }
  return `Critical risk. Single-cloud, single-region deployment on ${provider} with no backup or DR plan. A provider outage would cause full downtime.`;
}
