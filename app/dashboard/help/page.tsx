/**
 * /dashboard/help — the one-page reference for everything the
 * platform does. Linked from the profile menu. Every section maps
 * to a real shipped surface, so this page doubles as the platform's
 * own README.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { currentContext } from "@/lib/auth/currentContext";
import { ArrowRightIcon } from "@heroicons/react/24/outline";

export const dynamic = "force-dynamic";

interface Topic {
  title: string;
  body: string;
  href: string;
  hrefLabel: string;
}

const TOPICS: Array<{ section: string; rows: Topic[] }> = [
  {
    section: "First run",
    rows: [
      {
        title: "Connect a cloud",
        body: "AWS via CloudFormation Quick-Create. The in-stack Lambda POSTs back to /api/aws/cfn-callback when the stack reaches CREATE_COMPLETE, so you don't have to click FinishUrl.",
        href: "/dashboard/connect-cloud",
        hrefLabel: "Connect now",
      },
      {
        title: "Run your first scan",
        body: "Click Run scan now on the dashboard. The broker AssumeRoles into your account and reads inventory + posture. Two flavours: single-region fast (~10s) or all-regions sweep (~30s).",
        href: "/dashboard",
        hrefLabel: "Open dashboard",
      },
      {
        title: "Configure notifications",
        body: "Paste your Slack incoming-webhook URL and pick a severity floor. Scan-complete pings flow to whichever channels you've configured.",
        href: "/dashboard/settings/notifications",
        hrefLabel: "Notification settings",
      },
    ],
  },
  {
    section: "Day to day",
    rows: [
      {
        title: "Findings",
        body: "Every scan persists findings to AxiomFinding. Filter by severity, search by title or description, drill into a single finding for resources + recommendations + provenance, or download up to 5000 rows as CSV.",
        href: "/dashboard/findings",
        hrefLabel: "Open findings",
      },
      {
        title: "Scan history",
        body: "Every AxiomAgentRun shows here. Click a run to see exactly what it produced, including a 'vs previous scan: +3 new · −1 resolved' diff against the prior run.",
        href: "/dashboard/scans",
        hrefLabel: "Open scans",
      },
      {
        title: "Approvals",
        body: "Recommendations classified as 'security_remediation', 'iam_modification', or 'drift_correction' enter the approval queue. Approve or reject one at a time, or use Select all + bulk decide. Approved items emit a downloadable Terraform plan.",
        href: "/dashboard/approvals",
        hrefLabel: "Open queue",
      },
      {
        title: "Cost analysis",
        body: "Findings + pending savings rolled up by category (cost / security / resilience / performance / compliance). The headline number is what's available if every pending approval is applied.",
        href: "/dashboard/cost-analysis",
        hrefLabel: "Open cost analysis",
      },
    ],
  },
  {
    section: "Under the hood",
    rows: [
      {
        title: "Scheduled scans",
        body: "After your first manual scan, the platform creates an AxiomScheduledRun for the connected account. A Vercel cron at /api/cron/scheduled-scan-tick polls every 15 minutes and re-runs scans whose nextRunAt has elapsed. Three consecutive failures disables the schedule.",
        href: "/dashboard/scans",
        hrefLabel: "See scan history",
      },
      {
        title: "Audit trail",
        body: "Every meaningful platform event — scan.start, scan.success, approval.approve, connector.disconnected — lands in SecureAuditRecord with correlationIds linking related events. The trail is read-only and tenant-scoped.",
        href: "/dashboard/audit",
        hrefLabel: "Open audit",
      },
      {
        title: "Connection diagnostic",
        body: "Hit /api/admin/diag/connect-flow at any time to verify the platform's view of your tenant. Returns JSON showing your org id, the resolved User, all cloud-operator Leads, all ConnectorSetupSession rows, and a bridgeStatus verdict ('ok', 'lead_has_no_session', etc.) with a recommendedFix string.",
        href: "/api/admin/diag/connect-flow",
        hrefLabel: "Run diagnostic",
      },
    ],
  },
  {
    section: "Safety",
    rows: [
      {
        title: "Read-only by default",
        body: "Axiom assumes a cross-account read-only IAM role and only when scanning, for one hour at a time. STS sessions expire automatically. Approving a recommendation produces a Terraform plan you download and apply yourself — the platform never mutates your AWS without you running terraform apply.",
        href: "/dashboard/integrations",
        hrefLabel: "See all integrations",
      },
      {
        title: "Disconnect anytime",
        body: "Use the disconnect link on the Connected accounts row to clear platform state and stop scheduled scans. To remove the role from AWS, delete the CloudFormation stack on your side.",
        href: "/dashboard",
        hrefLabel: "Open dashboard",
      },
    ],
  },
];

export default async function HelpPage() {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated) {
    redirect("/auth/signin?callbackUrl=/dashboard/help");
  }

  return (
    <div className="max-w-3xl mx-auto px-1 -mt-2">
      <header className="mb-12">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">help</p>
        <h1 className="text-[34px] sm:text-[40px] leading-[1.05] font-semibold text-white tracking-[-0.03em] mb-3">
          What this platform does.
        </h1>
        <p className="text-[15px] text-zinc-400 leading-relaxed max-w-xl">
          One-page reference for everything wired into Axiom right now. Each
          section links to the live surface that does the thing.
        </p>
      </header>

      <div className="space-y-12">
        {TOPICS.map((topic) => (
          <section key={topic.section}>
            <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-5">{topic.section}</p>
            <ul className="space-y-6">
              {topic.rows.map((row) => (
                <li key={row.title}>
                  <p className="text-[14px] font-medium text-white mb-1.5">{row.title}</p>
                  <p className="text-[13px] text-zinc-400 leading-relaxed mb-2 max-w-2xl">{row.body}</p>
                  <Link
                    href={row.href}
                    className="inline-flex items-center gap-1.5 text-[12px] text-zinc-300 hover:text-white transition-colors"
                  >
                    {row.hrefLabel}
                    <ArrowRightIcon className="h-3 w-3" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
