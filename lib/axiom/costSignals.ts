export type CostSignal = {
  resource: string;
  issue: string;
  monthlyCostEstimate: { low: number; high: number };
  annualSavingsEstimate: { low: number; high: number };
  confidence: "measured" | "estimated";
  proFix: string;
  proOutputPreview?: string[];
};

export type CostSummary = {
  signals: CostSignal[];
  totalAnnualSavings: { low: number; high: number };
};

type SnapshotInput = {
  ec2InstanceCount: number;
  s3BucketCount: number;
  regions: string[];
  flags: { singleRegion: boolean; noBackupsDetected: boolean };
  insights?: Array<{ title: string; severity: string }>;
};

const AVG_EC2_MONTHLY = 85;
const RIGHTSIZING_SAVINGS_PCT = 0.25;
const RESERVED_SAVINGS_PCT = 0.35;

const AVG_S3_MONTHLY_PER_BUCKET = 23;
const TIERING_SAVINGS_PCT = 0.30;

const MULTI_REGION_OVERHEAD_PER_INSTANCE = 12;
const SINGLE_REGION_DOWNTIME_COST_PER_INSTANCE = 45;

export function deriveCostSignals(
  snapshot: SnapshotInput,
  monthlySpend?: number | null,
): CostSummary {
  const signals: CostSignal[] = [];

  const ec2 = snapshot.ec2InstanceCount;
  const s3 = snapshot.s3BucketCount;

  if (ec2 > 0) {
    const baseMonthlyCost = monthlySpend
      ? (monthlySpend * 0.6)
      : (ec2 * AVG_EC2_MONTHLY);

    const rightsizeLow = Math.round(baseMonthlyCost * RIGHTSIZING_SAVINGS_PCT * 0.6);
    const rightsizeHigh = Math.round(baseMonthlyCost * RIGHTSIZING_SAVINGS_PCT * 1.2);
    signals.push({
      resource: `${ec2} EC2 instance${ec2 !== 1 ? "s" : ""}`,
      issue: "Likely oversized or under-utilized instances",
      monthlyCostEstimate: { low: Math.round(baseMonthlyCost * 0.8), high: Math.round(baseMonthlyCost * 1.2) },
      annualSavingsEstimate: { low: rightsizeLow * 12, high: rightsizeHigh * 12 },
      confidence: monthlySpend ? "measured" : "estimated",
      proFix: "Auto-generate Terraform to right-size instances",
    });

    if (!monthlySpend || monthlySpend > 500) {
      const reservedLow = Math.round(baseMonthlyCost * RESERVED_SAVINGS_PCT * 0.5);
      const reservedHigh = Math.round(baseMonthlyCost * RESERVED_SAVINGS_PCT);
      const hourlyCommitment = (baseMonthlyCost * 0.65 / 730).toFixed(2);
      const coveragePct = ec2 > 10 ? "70–80%" : "75–90%";
      signals.push({
        resource: "On-Demand pricing",
        issue: "No Reserved Instance or Savings Plan detected",
        monthlyCostEstimate: { low: Math.round(baseMonthlyCost), high: Math.round(baseMonthlyCost * 1.2) },
        annualSavingsEstimate: { low: reservedLow * 12, high: reservedHigh * 12 },
        confidence: "estimated",
        proFix: "Generate RI/Savings Plan recommendation report",
        proOutputPreview: [
          `Recommended: Compute Savings Plan, 1yr no-upfront`,
          `Coverage: ${coveragePct} of your ${ec2}-instance baseline`,
          `Hourly commitment: ~$${hourlyCommitment}/hr`,
          `Projected savings: $${(reservedLow * 12).toLocaleString()} – $${(reservedHigh * 12).toLocaleString()}/yr`,
        ],
      });
    }
  }

  if (s3 > 5) {
    const s3MonthlyCost = s3 * AVG_S3_MONTHLY_PER_BUCKET;
    const tierLow = Math.round(s3MonthlyCost * TIERING_SAVINGS_PCT * 0.5);
    const tierHigh = Math.round(s3MonthlyCost * TIERING_SAVINGS_PCT);
    signals.push({
      resource: `${s3} S3 buckets`,
      issue: "Storage tiering not verified — likely using Standard for cold data",
      monthlyCostEstimate: { low: Math.round(s3MonthlyCost * 0.7), high: Math.round(s3MonthlyCost * 1.3) },
      annualSavingsEstimate: { low: tierLow * 12, high: tierHigh * 12 },
      confidence: "estimated",
      proFix: "Scan bucket access patterns and apply Intelligent-Tiering",
    });
  }

  if (snapshot.flags.singleRegion && ec2 > 0) {
    const downtimeCost = ec2 * SINGLE_REGION_DOWNTIME_COST_PER_INSTANCE;
    signals.push({
      resource: "Single-region deployment",
      issue: `All ${ec2} instances in one region — outage risk with no failover`,
      monthlyCostEstimate: { low: 0, high: 0 },
      annualSavingsEstimate: { low: Math.round(downtimeCost * 6), high: Math.round(downtimeCost * 18) },
      confidence: "estimated",
      proFix: "Generate multi-region Terraform with Route 53 failover",
    });
  }

  if (snapshot.regions.length > 2 && ec2 > 3) {
    const overheadMonthly = ec2 * MULTI_REGION_OVERHEAD_PER_INSTANCE;
    signals.push({
      resource: `${snapshot.regions.length} active regions`,
      issue: "Multi-region spread may include unnecessary redundancy",
      monthlyCostEstimate: { low: Math.round(overheadMonthly * 0.5), high: overheadMonthly },
      annualSavingsEstimate: { low: Math.round(overheadMonthly * 0.3) * 12, high: Math.round(overheadMonthly * 0.6) * 12 },
      confidence: "estimated",
      proFix: "Analyze region utilization and consolidate workloads",
    });
  }

  const totalLow = signals.reduce((sum, s) => sum + s.annualSavingsEstimate.low, 0);
  const totalHigh = signals.reduce((sum, s) => sum + s.annualSavingsEstimate.high, 0);

  return {
    signals,
    totalAnnualSavings: { low: totalLow, high: totalHigh },
  };
}
