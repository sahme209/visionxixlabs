import type { Metadata } from "next";
import Link from "next/link";
import { DocHeader, DocSection, Callout, DocFooterNav, DocFeedback } from "@/components/docs/DocPrimitives";

export const metadata: Metadata = {
  title: "Troubleshooting — Axiom Documentation",
  description: "Common errors during onboarding, scanning, execution, and ReleaseOps — and exactly how to fix them.",
};

const ISSUES = [
  {
    section: "AWS connection",
    items: [
      { code: "AccessDenied (sts:AssumeRole)", cause: "Trust policy points at the wrong Axiom AWS account, or the role doesn't exist.", fix: "Re-copy the trust policy from /operator/onboarding exactly. Confirm the role appears in IAM → Roles." },
      { code: "InvalidExternalId", cause: "The External ID in your trust policy condition doesn't match what Axiom sends.", fix: "Re-paste the External ID from the onboarding screen. It must match character-for-character. If you rotated, re-onboard to get a fresh ID." },
      { code: "Cannot assume role: TokenSignatureInvalid", cause: "Clock skew on the role's account, or a permissions boundary blocks sts:AssumeRole.", fix: "Check the role has no Permissions Boundary that excludes sts:AssumeRole. Confirm AWS account-level clock is in sync." },
      { code: "MalformedPolicyDocumentException", cause: "JSON syntax error in the trust or permission policy.", fix: "Use AWS Console's built-in JSON validator. Common issues: trailing commas, missing quotes, copy-paste line breaks." },
    ],
  },
  {
    section: "Scanning",
    items: [
      { code: "Scan returns 0 resources", cause: "Role has no permission to describe resources in the selected regions, or the regions truly have no resources.", fix: "Run aws sts get-caller-identity --profile axiom-role in CloudShell to confirm assumption works. Try a region with known resources." },
      { code: "Partial scan — some services missing", cause: "Specific service Describe permission missing, or service not available in the region.", fix: "Confirm the permission policy includes all Describe* actions for the service. Check service availability for the region in AWS docs." },
      { code: "Scan stuck at 'queued'", cause: "Background worker is offline or queue is saturated.", fix: "Wait 60 seconds and refresh. If still queued, disconnect/reconnect the cloud account to retrigger." },
      { code: "Scan takes > 5 minutes", cause: "Large account (thousands of resources) — normal. Or rate limiting from AWS.", fix: "Initial scans on accounts with 1000+ resources can take 10-15 minutes. Subsequent scans are incremental and complete in 1-3 minutes." },
    ],
  },
  {
    section: "Execution + approvals",
    items: [
      { code: "Plan blocked: blast radius too broad", cause: "Plan affects more resources than the configured blast-radius threshold.", fix: "Split the plan into smaller phases. Or raise the blast-radius threshold in governance settings (requires approval)." },
      { code: "Plan blocked: rollback path unverified", cause: "Axiom can't construct a pre-verified rollback for at least one item.", fix: "Review the plan items — usually a missing AWS backup, snapshot, or version. Enable the missing capability and re-plan." },
      { code: "Approval expired", cause: "Plan items expire after 24 hours if not approved.", fix: "Re-run the scan to generate a fresh plan with current state. Approve within the window." },
      { code: "Apply failed mid-execution", cause: "Network, AWS API throttling, or pre-flight condition changed between approval and apply.", fix: "Rollback fires automatically. Check audit log for the exact failure. Re-plan and re-approve." },
    ],
  },
  {
    section: "ReleaseOps",
    items: [
      { code: "GitHub connector won't authorize", cause: "Org-level OAuth restriction or missing scopes.", fix: "Confirm the GitHub App installation has 'Read access to actions, contents, deployments, metadata, pull requests'. Org admin may need to approve." },
      { code: "Pipelines not appearing", cause: "Connector connected but webhook delivery failing.", fix: "Check GitHub App → Advanced → Recent Deliveries for failure reason. Re-deliver from there to retry." },
      { code: "Readiness score shows N/A", cause: "Not enough deployment history (< 5 deploys) to compute the trend.", fix: "Wait for additional deploys. Or import historical data from your CI/CD system." },
    ],
  },
  {
    section: "Dashboard + UI",
    items: [
      { code: "Activity feed empty", cause: "No real activity yet — feed falls back to sample events for orientation.", fix: "Run your first scan. After the first scan, the feed automatically switches to live data and shows a 'Live data' badge in the footer." },
      { code: "Charts show '—' or zero", cause: "Insufficient scan history to render trends.", fix: "At least 2-3 scans are needed to render trend lines. After a week of recurring scans, all charts populate fully." },
    ],
  },
];

export default function TroubleshootingPage() {
  return (
    <>
      <DocHeader
        kicker="Reference · Troubleshooting"
        title="Troubleshooting common errors."
        summary="Every error Axiom surfaces has a specific cause and a specific fix. This page collects the issues we see most often, grouped by where they happen."
      />

      <Callout variant="tip" title="Faster path">
        Every error message in the product is a clickable link back to its troubleshooting entry on this page. If you arrived from an error, scroll to the section matching your scenario.
      </Callout>

      {ISSUES.map((section) => (
        <DocSection key={section.section} id={section.section.toLowerCase().replace(/\s+/g, "-")} title={section.section}>
          <div className="space-y-3">
            {section.items.map((item) => (
              <div key={item.code} className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4">
                <p className="text-amber-400 font-mono text-[12px] font-semibold mb-2">{item.code}</p>
                <div className="space-y-2 text-sm">
                  <div>
                    <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-0.5">Cause</p>
                    <p className="text-zinc-400 leading-relaxed">{item.cause}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest mb-0.5">Fix</p>
                    <p className="text-zinc-300 leading-relaxed">{item.fix}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DocSection>
      ))}

      <DocSection id="still-stuck" title="Still stuck?">
        <p>
          If your issue isn&apos;t here, the cause is non-obvious, or you suspect a bug:
        </p>
        <ul className="list-disc list-inside space-y-1 text-zinc-400 ml-1">
          <li>Open the relevant scan in the dashboard and inspect the audit log — every action is logged with the exact failure reason</li>
          <li>Check the <Link href="/docs/faq" className="text-violet-300 hover:text-violet-200">FAQ</Link> for known edge cases</li>
          <li>Reach out via <Link href="/contact" className="text-violet-300 hover:text-violet-200">/contact</Link> — include the run ID, scan ID, or error code shown in the dashboard</li>
        </ul>
      </DocSection>

      <DocFooterNav
        prev={{ href: "/docs/security-model", label: "Security model" }}
        next={{ href: "/docs/faq", label: "FAQ" }}
      />
      <DocFeedback />
    </>
  );
}
