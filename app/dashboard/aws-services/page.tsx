"use client";

/**
 * /dashboard/aws-services — AWS Service Inventory cockpit.
 *
 * Single page rendering all 14 service sections returned by
 * /api/cloud/aws-services. Per-section honest mode pill (live /
 * blocked / preview) + per-section count tile grid + drill-down
 * to the underlying resources.
 *
 * Desktop runtime renders this via the same /api endpoint when
 * paired — no separate code path needed.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ShieldCheckIcon,
  ServerStackIcon,
  CloudIcon,
  KeyIcon,
  CircleStackIcon,
  CpuChipIcon,
  ScaleIcon,
  ArchiveBoxIcon,
  LockClosedIcon,
  DocumentTextIcon,
  WrenchScrewdriverIcon,
  EnvelopeIcon,
  GlobeAltIcon,
  ShieldExclamationIcon,
} from "@heroicons/react/24/outline";

type Mode = "live" | "preview" | "blocked" | "disabled" | "unknown" | "partial_live";

interface SectionMeta { mode: Mode; total?: number; limitations?: string[] }
interface AwsReport {
  generatedAt: string;
  region?: string;
  overallSourceMode: Mode;
  lambda: SectionMeta & { total: number; deprecatedRuntimeCount: number; runtimeBreakdown: Record<string, number> };
  rds: SectionMeta & { total: number; unencryptedCount: number; publiclyAccessibleCount: number; multiAzCount: number; backupsDisabledCount: number; noDeletionProtectionCount: number; noPerformanceInsightsCount: number; staleSnapshotCount: number };
  iam: SectionMeta & { totalUsers: number; totalRoles: number; usersWithoutMfaCount: number; usersWithAdminPolicyCount: number; rolesWithWildcardTrustCount: number; staleUsersCount: number };
  s3: SectionMeta & { total: number; publiclyExposedCount: number; unencryptedCount: number };
  ec2: SectionMeta & { total: number; runningCount: number; stoppedCount: number; publicIpCount: number; imdsv2Count: number };
  network: SectionMeta & { vpcCount: number; securityGroupCount: number; wideOpenIngressCount: number; wideOpenAdminPortCount: number };
  loadBalancers: SectionMeta & { total: number; publicCount: number };
  messaging: SectionMeta & { snsTopicCount: number; sqsQueueCount: number };
  patchCompliance: SectionMeta & { totalInstances: number; compliantCount: number; nonCompliantCount: number; totalMissingPatches: number };
  logGroups: SectionMeta & { total: number; totalStoredBytes: number; retentionUnboundedCount: number; unencryptedCount: number };
  certificates: SectionMeta & { total: number; issuedCount: number; expiredCount: number; expiringSoonCount: number };
  threats: SectionMeta & { detectorEnabled: boolean; totalFindings: number; highCount: number; mediumCount: number; lowCount: number };
  secrets: SectionMeta & { total: number; rotationDisabledCount: number; staleRotationCount: number };
  backups: SectionMeta & { vaultCount: number; totalRecoveryPoints: number; emptyVaultCount: number };
  safetyContract: string;
  limitations: string[];
  safeNextAction: { label: string; href: string };
}

const MODE_VISUAL: Record<Mode, { pill: string; label: string }> = {
  live:         { pill: "bg-emerald-500/15 text-emerald-300", label: "live" },
  partial_live: { pill: "bg-cyan-500/15 text-cyan-300",       label: "partial" },
  preview:      { pill: "bg-white/15 text-zinc-300",     label: "preview" },
  blocked:      { pill: "bg-rose-500/15 text-rose-300",       label: "blocked" },
  disabled:     { pill: "bg-zinc-700/40 text-zinc-300",       label: "disabled" },
  unknown:      { pill: "bg-zinc-700/40 text-zinc-300",       label: "unknown" },
};

export default function AwsServicesPage() {
  const [report, setReport] = useState<AwsReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/cloud/aws-services", { credentials: "include" })
      .then((r) => r.json())
      .then((json: { ok?: boolean; data?: AwsReport; error?: { userMessage?: string } }) => {
        if (cancelled) return;
        if (json.ok && json.data) setReport(json.data);
        else setError(json.error?.userMessage ?? "AWS service inventory unavailable.");
      })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Network error."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="relative">
      <div className="relative mb-8 rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.025] via-white/[0.015] to-transparent p-6 md:p-8 overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-90 pointer-events-none"
          style={{
            background:
              "radial-gradient(900px 320px at 12% 0%, rgba(251,146,60,0.10), transparent 60%), radial-gradient(700px 260px at 88% 110%, rgba(45,212,191,0.06), transparent 60%)",
          }}
          aria-hidden
        />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" aria-hidden />

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
            <CloudIcon className="h-3.5 w-3.5 text-zinc-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-300">
              AWS Service Inventory
            </span>
          </span>
          {report?.generatedAt && (
            <span className="text-[10px] font-mono text-zinc-500">last sync {new Date(report.generatedAt).toLocaleTimeString()}</span>
          )}
          {report?.region && (
            <span className="text-[10px] font-mono text-zinc-500">region {report.region}</span>
          )}
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mb-3">
          14 AWS services. <span className="text-gradient">One call.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
          Lambda · RDS · IAM · S3 · EC2 · VPC · ELB · SNS/SQS · SSM Patch · CloudWatch Logs · ACM · GuardDuty · Secrets Manager · AWS Backup. Every section pulls from a real SDK call — no fabricated counts ever.
        </p>
      </div>

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
          <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">// composing AWS service inventory… (parallel SDK calls)</p>
        </div>
      )}
      {!loading && error && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-white/[0.18] bg-white/[0.04] p-5 mb-6">
          <p className="text-[11px] font-mono text-zinc-300/80 uppercase tracking-[0.18em] mb-1">// inventory unavailable</p>
          <p className="text-[13px] text-zinc-300">{error}</p>
        </div>
      )}

      {!loading && !error && report && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
            <Section icon={CpuChipIcon}    title="Lambda"          mode={report.lambda.mode}
              stats={[["Total", report.lambda.total], ["EOL runtime", report.lambda.deprecatedRuntimeCount, "rose"]]} />
            <Section icon={CircleStackIcon} title="RDS"             mode={report.rds.mode}
              stats={[
                ["Instances", report.rds.total],
                ["Unencrypted", report.rds.unencryptedCount, "rose"],
                ["Public", report.rds.publiclyAccessibleCount, "rose"],
                ["No backups", report.rds.backupsDisabledCount, "rose"],
                ["Stale snap", report.rds.staleSnapshotCount, "amber"],
                ["No Perf Ins.", report.rds.noPerformanceInsightsCount, "amber"],
              ]} />
            <Section icon={LockClosedIcon} title="IAM"             mode={report.iam.mode}
              stats={[
                ["Users", report.iam.totalUsers], ["Roles", report.iam.totalRoles],
                ["No MFA", report.iam.usersWithoutMfaCount, "rose"],
                ["Admin", report.iam.usersWithAdminPolicyCount, "amber"],
                ["Wildcard trust", report.iam.rolesWithWildcardTrustCount, "rose"],
                ["Stale (>90d)", report.iam.staleUsersCount, "amber"],
              ]} />
            <Section icon={ArchiveBoxIcon} title="S3 Buckets"      mode={report.s3.mode}
              stats={[
                ["Total", report.s3.total],
                ["Public exposed", report.s3.publiclyExposedCount, "rose"],
                ["Unencrypted", report.s3.unencryptedCount, "rose"],
              ]} />
            <Section icon={ServerStackIcon} title="EC2"             mode={report.ec2.mode}
              stats={[
                ["Total", report.ec2.total],
                ["Running", report.ec2.runningCount],
                ["Public IP", report.ec2.publicIpCount, "amber"],
                ["IMDSv2", report.ec2.imdsv2Count, "emerald"],
              ]} />
            <Section icon={GlobeAltIcon}   title="VPC + Security Groups" mode={report.network.mode}
              stats={[
                ["VPCs", report.network.vpcCount],
                ["SGs", report.network.securityGroupCount],
                ["0.0.0.0/0 open", report.network.wideOpenIngressCount, "rose"],
                ["SSH/RDP open", report.network.wideOpenAdminPortCount, "rose"],
              ]} />
            <Section icon={ScaleIcon}      title="Load Balancers"  mode={report.loadBalancers.mode}
              stats={[
                ["Total", report.loadBalancers.total],
                ["Internet-facing", report.loadBalancers.publicCount, "amber"],
              ]} />
            <Section icon={EnvelopeIcon}   title="SNS + SQS"       mode={report.messaging.mode}
              stats={[
                ["SNS topics", report.messaging.snsTopicCount],
                ["SQS queues", report.messaging.sqsQueueCount],
              ]} />
            <Section icon={WrenchScrewdriverIcon} title="SSM Patch Compliance" mode={report.patchCompliance.mode}
              stats={[
                ["Instances", report.patchCompliance.totalInstances],
                ["Compliant", report.patchCompliance.compliantCount, "emerald"],
                ["Non-compliant", report.patchCompliance.nonCompliantCount, "rose"],
                ["Missing patches", report.patchCompliance.totalMissingPatches, "amber"],
              ]} />
            <Section icon={DocumentTextIcon} title="CloudWatch Log Groups" mode={report.logGroups.mode}
              stats={[
                ["Groups", report.logGroups.total],
                ["Stored GB", Math.round(report.logGroups.totalStoredBytes / 1024 / 1024 / 1024)],
                ["No retention", report.logGroups.retentionUnboundedCount, "amber"],
                ["Unencrypted", report.logGroups.unencryptedCount, "amber"],
              ]} />
            <Section icon={KeyIcon}        title="ACM Certificates" mode={report.certificates.mode}
              stats={[
                ["Total", report.certificates.total],
                ["Issued", report.certificates.issuedCount, "emerald"],
                ["Expired", report.certificates.expiredCount, "rose"],
                ["Expiring ≤30d", report.certificates.expiringSoonCount, "amber"],
              ]} />
            <Section icon={ShieldExclamationIcon} title="GuardDuty Threats" mode={report.threats.mode}
              stats={[
                ["Detector", report.threats.detectorEnabled ? "ON" : "OFF", report.threats.detectorEnabled ? "emerald" : "rose"],
                ["Findings", report.threats.totalFindings],
                ["High", report.threats.highCount, "rose"],
                ["Medium", report.threats.mediumCount, "amber"],
              ]} />
            <Section icon={KeyIcon}        title="Secrets Manager"  mode={report.secrets.mode}
              stats={[
                ["Total", report.secrets.total],
                ["No rotation", report.secrets.rotationDisabledCount, "amber"],
                ["Stale (>90d)", report.secrets.staleRotationCount, "rose"],
              ]} />
            <Section icon={ArchiveBoxIcon} title="AWS Backup vaults" mode={report.backups.mode}
              stats={[
                ["Vaults", report.backups.vaultCount],
                ["Recovery points", report.backups.totalRecoveryPoints, "emerald"],
                ["Empty vaults", report.backups.emptyVaultCount, "rose"],
              ]} />
          </div>

          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5 mb-8 flex items-start gap-3">
            <ShieldCheckIcon className="h-5 w-5 text-emerald-300 mt-0.5 shrink-0" />
            <div>
              <p className="text-[11px] font-mono text-emerald-300/80 uppercase tracking-[0.18em] mb-1">// safety contract</p>
              <p className="text-[13px] text-emerald-100 font-semibold leading-snug">
                safetyContract = <code className="font-mono text-[12px] bg-black/30 border border-white/[0.06] rounded px-1.5 py-px">{report.safetyContract}</code>
              </p>
              <p className="text-[12px] text-zinc-300 leading-relaxed mt-1">
                Every section is read-only by construction. 14 parallel SDK calls, per-section failure isolated.
              </p>
              <Link href={report.safeNextAction.href} className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-200 hover:text-emerald-100">
                {report.safeNextAction.label} <ArrowRightIcon className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

type StatTone = "emerald" | "amber" | "rose" | "cyan" | "zinc";

function Section({ icon: Icon, title, mode, stats }: {
  icon: typeof CloudIcon;
  title: string;
  mode: Mode;
  stats: ([string, number | string] | [string, number | string, StatTone])[];
}) {
  const v = MODE_VISUAL[mode] ?? MODE_VISUAL.unknown;
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 hover:-translate-y-0.5 transition-all">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="h-4 w-4 text-white/70 shrink-0" />
          <p className="text-[13px] font-semibold text-white tracking-tight truncate">{title}</p>
        </div>
        <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${v.pill}`}>{v.label}</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {stats.map(([label, value, tone]) => {
          const t = (tone ?? "zinc") as StatTone;
          const cls = {
            emerald: "border-emerald-500/[0.18] bg-emerald-500/[0.03] text-emerald-200",
            amber:   "border-white/[0.18] bg-white/[0.03] text-zinc-200",
            rose:    "border-rose-500/[0.18] bg-rose-500/[0.03] text-rose-200",
            cyan:    "border-cyan-500/[0.18] bg-cyan-500/[0.03] text-cyan-200",
            zinc:    "border-white/[0.06] bg-white/[0.02] text-zinc-200",
          }[t];
          return (
            <div key={label} className={`rounded-md border ${cls} p-2`}>
              <p className="text-[9px] font-mono uppercase tracking-wider opacity-70">{label}</p>
              <p className="text-[16px] font-bold mt-0.5">{value}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
