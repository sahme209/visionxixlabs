import type { Metadata } from "next";
import Link from "next/link";
import { DocHeader, DocSection, Step, Callout, TrustGrid, DocFooterNav, DocFeedback } from "@/components/docs/DocPrimitives";

export const metadata: Metadata = {
  title: "Infrastructure scanning — Axiom Documentation",
  description: "What Axiom scans, what it doesn't, the scan lifecycle, provider differences, and how to troubleshoot scan failures.",
};

export default function ScanningPage() {
  return (
    <>
      <DocHeader
        kicker="Operate · Scanning"
        title="How infrastructure scanning works."
        summary="Every scan is read-only. Axiom enumerates resources via Describe/List/Get APIs only, builds a typed snapshot, and feeds it into the reasoning engine. Nothing is modified, nothing is read that isn't configuration metadata."
      />

      <Callout variant="safe" title="The model in one sentence">
        A scan is a read-only enumeration of your infrastructure across the regions you authorized — no writes, no object contents, no secrets, no row data. The output is a typed snapshot stored in your tenant only.
      </Callout>

      <DocSection id="what-is-scanned" title="What Axiom scans" kicker="01">
        <p>For AWS (full implementation), scans cover:</p>
        <ul className="list-disc list-inside space-y-1 text-zinc-400 ml-1">
          <li><strong>Compute:</strong> EC2 instances, Lambda functions, ECS/Fargate tasks, Auto Scaling Groups</li>
          <li><strong>Storage:</strong> S3 bucket configuration (not contents), EBS volumes, EFS filesystems, snapshots</li>
          <li><strong>Databases:</strong> RDS instances + clusters, ElastiCache, DynamoDB tables, Aurora</li>
          <li><strong>Networking:</strong> VPCs, subnets, security groups, NACLs, Transit Gateways, NAT gateways, ELBs/ALBs</li>
          <li><strong>Identity:</strong> IAM roles, policies, trust relationships, Service Control Policies (read-only audit)</li>
          <li><strong>Observability:</strong> CloudWatch metrics, log group configurations (not log contents), alarms</li>
          <li><strong>Cost signals:</strong> Cost Explorer aggregates for cost-trend reasoning</li>
        </ul>
      </DocSection>

      <DocSection id="what-not-scanned" title="What Axiom does NOT scan" kicker="02 · Hard guarantees">
        <ul className="list-disc list-inside space-y-1 text-zinc-400 ml-1">
          <li>Object contents in S3 buckets — only metadata (encryption, ACL, lifecycle, versioning)</li>
          <li>Database row contents — only configuration metadata</li>
          <li>Secrets in Secrets Manager or KMS — only their existence and rotation policy</li>
          <li>CloudTrail event history — only the configuration of the trail itself</li>
          <li>Customer data of any kind</li>
        </ul>
        <p>
          See <Link href="/docs/security-model" className="text-violet-300 hover:text-violet-200">security model</Link> for the full data-storage table.
        </p>
      </DocSection>

      <DocSection id="lifecycle" title="The scan lifecycle" kicker="03 · Lifecycle">
        <Step number={1} title="Connection check">
          <p>Axiom calls <code>sts:AssumeRole</code> with the External ID. Receives 1-hour temporary credentials.</p>
        </Step>
        <Step number={2} title="Region selection">
          <p>Iterates over the regions you authorized during onboarding. Each region is scanned in parallel.</p>
        </Step>
        <Step number={3} title="Resource enumeration">
          <p>For each service (EC2, S3, RDS, IAM, etc.), Axiom calls the relevant Describe/List/Get APIs. Pagination is handled automatically.</p>
        </Step>
        <Step number={4} title="Snapshot construction">
          <p>Raw responses are normalized into a typed snapshot. Provider-specific identifiers are preserved for traceability.</p>
        </Step>
        <Step number={5} title="Reasoning engine">
          <p>Snapshot feeds the 12-step cognitive loop: observe → interpret → reason → plan → verify → execute. Findings + recommendations + execution plan emerge.</p>
        </Step>
        <Step number={6} title="Persistence + audit">
          <p>Snapshot + findings + plan persist in your tenant only. <code>ExecutionLog</code> + <code>AxiomAuditEvent</code> capture the scan operation immutably.</p>
        </Step>
      </DocSection>

      <DocSection id="provider-differences" title="Provider differences" kicker="04 · AWS vs Azure vs GCP">
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li><strong>AWS</strong> — Full implementation. Scan, reasoning, plan, execute, monitor, learn.</li>
          <li><strong>Azure</strong> — Scan + topology mapping live. Service Principal connector. Reasoning + execution rolling out Q2 2026.</li>
          <li><strong>GCP</strong> — Scan + topology mapping live. Service Account connector. Reasoning + execution rolling out Q3 2026.</li>
        </ul>
      </DocSection>

      <DocSection id="status" title="Reading scan status">
        <ul className="list-disc list-inside space-y-1 text-zinc-400 ml-1">
          <li><strong>Queued</strong> — Scan accepted, waiting for worker</li>
          <li><strong>Running</strong> — Active enumeration in progress; partial results may stream to the dashboard</li>
          <li><strong>Completed</strong> — Snapshot + findings + plan persisted; status flips to operational</li>
          <li><strong>Failed</strong> — Surface the exact AWS error code; link to troubleshooting</li>
        </ul>
      </DocSection>

      <DocSection id="trust" title="Trust questions">
        <TrustGrid
          items={[
            { question: "What is happening during a scan?", answer: "Read-only enumeration of infrastructure across authorized regions. No writes, no object reads, no secret access." },
            { question: "Why does Axiom need this?", answer: "To reason about your infrastructure it needs an accurate snapshot. Snapshots refresh on schedule or on demand." },
            { question: "Is the scan safe?", answer: "Yes — assume-role + read-only IAM permissions. Throttled to avoid impact on production APIs." },
            { question: "What does Axiom store after the scan?", answer: "Configuration metadata + findings + plan. Never object/row contents, never secrets, never access keys." },
            { question: "Can I revoke or pause scans?", answer: "Yes — disable the recurring workflow in Axiom Agent under Workflows or delete the IAM role to revoke completely." },
            { question: "What if the scan fails?", answer: "Exact AWS error code is shown with a link to troubleshooting. Failed scans do not consume execution quota." },
          ]}
        />
      </DocSection>

      <DocSection id="troubleshooting" title="Common scan errors">
        <p>
          See the dedicated <Link href="/docs/troubleshooting#scanning" className="text-violet-300 hover:text-violet-200">scanning troubleshooting section</Link> for: scan returns 0 resources, partial scan, stuck at queued, scan takes &gt; 5 minutes.
        </p>
      </DocSection>

      <DocFooterNav
        prev={{ href: "/docs/aws-setup", label: "AWS setup" }}
        next={{ href: "/docs/approval-workflow", label: "Approval workflow" }}
      />
      <DocFeedback />
    </>
  );
}
