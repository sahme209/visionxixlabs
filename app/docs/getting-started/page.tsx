import type { Metadata } from "next";
import Link from "next/link";
import { DocHeader, DocSection, Step, Callout, TrustGrid, DocFooterNav, DocFeedback, CodeBlock } from "@/components/docs/DocPrimitives";

export const metadata: Metadata = {
  title: "Getting started — Axiom Documentation",
  description: "Sign up, connect AWS via IAM role, run your first scan, review findings, and approve your first execution plan — under 5 minutes.",
};

export default function GettingStartedPage() {
  return (
    <>
      <DocHeader
        kicker="Start here"
        title="Getting started with Axiom."
        summary="Sign up, connect AWS via IAM role, run your first scan, and review findings — typically under 5 minutes. Nothing changes in your cloud without your explicit approval."
      />

      <Callout variant="safe" title="What you'll do in this guide">
        Create an Axiom account, generate a read-only IAM role in AWS, paste the Role ARN, run your first scan, and review the findings + execution plan. <strong>No changes are applied to your infrastructure during this flow.</strong>
      </Callout>

      <DocSection id="prereqs" title="Prerequisites" kicker="00 · Before you begin">
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400">
          <li>An AWS account where you have permission to create an IAM role</li>
          <li>~5 minutes</li>
          <li>A web browser (no CLI required for the first scan)</li>
        </ul>
      </DocSection>

      <DocSection id="step-1" title="Step 1 — Create your Axiom account" kicker="01">
        <Step number={1} title="Sign up at /auth/signup">
          <p>
            Visit <Link href="/auth/signup">/auth/signup</Link> and create an account with your work email. No credit card required for the free tier.
          </p>
          <p>
            You&apos;ll land in the dashboard. The dashboard has six tiles: Connect Cloud, Topology, Memory, Workflows, ReleaseOps, Operations, Resilience, and Desktop Agent.
          </p>
        </Step>
      </DocSection>

      <DocSection id="step-2" title="Step 2 — Connect AWS" kicker="02">
        <Step number={1} title="Open Cloud Operator onboarding">
          <p>
            Sign in, then from the dashboard click <strong>Connect a cloud</strong> (or go directly to <Link href="/dashboard/connect-cloud">/dashboard/connect-cloud</Link>). Cloud connect is now portal-only — you can't wire it up before signing in.
          </p>
          <p>The onboarding wizard walks you through five steps: provider selection → IAM role creation → ARN paste → connection test → first scan.</p>
        </Step>
        <Step number={2} title="Generate a read-only IAM role">
          <p>
            Axiom shows you the exact role policy to attach and an External ID to prevent confused-deputy attacks. Either:
          </p>
          <ul className="list-disc list-inside space-y-1 text-zinc-400 ml-1">
            <li>Use the one-click CloudFormation launch button (recommended)</li>
            <li>Or create the role manually in IAM with the trust policy and permissions Axiom displays</li>
          </ul>
          <p>
            See <Link href="/docs/aws-setup">AWS setup</Link> for the exact policy, what each permission does, and why each one is needed.
          </p>
        </Step>
        <Step number={3} title="Paste the Role ARN + test the connection">
          <p>
            Paste the Role ARN back into Axiom. The connection test calls <code>sts:AssumeRole</code> with the External ID, then runs a no-op <code>sts:GetCallerIdentity</code> to confirm read access.
          </p>
          <CodeBlock language="response · connection test">
{`{
  "status": "connected",
  "accountId": "123456789012",
  "callerArn": "arn:aws:sts::123456789012:assumed-role/axiom-agent-role/...",
  "permissions": "read-only",
  "regions": ["us-east-1", "us-west-2"]
}`}
          </CodeBlock>
        </Step>
      </DocSection>

      <DocSection id="step-3" title="Step 3 — Run your first scan" kicker="03">
        <Step number={1} title="Trigger the initial scan">
          <p>
            Click <strong>Run scan</strong>. Axiom enumerates EC2 instances, S3 buckets, RDS databases, IAM resources, security groups, and other supported resource types across your selected regions.
          </p>
          <p>
            A typical first scan completes in 60–180 seconds. Progress is visible in real time via the activity feed at <Link href="/dashboard/command-center">/dashboard/command-center</Link>.
          </p>
        </Step>
        <Step number={2} title="Review findings">
          <p>
            Findings are grouped by category (cost, security, drift, performance, compliance) and severity. Each finding includes affected resources, severity reasoning, recommended action, and an estimated monthly impact.
          </p>
        </Step>
        <Step number={3} title="Review the execution plan">
          <p>
            Axiom generates a phased execution plan grouping low-risk fixes together. Each plan item includes:
          </p>
          <ul className="list-disc list-inside space-y-1 text-zinc-400 ml-1">
            <li>Affected resources + current state vs. recommended state</li>
            <li>Generated Terraform (or CLI commands)</li>
            <li>Blast radius classification</li>
            <li>Pre-verified rollback strategy with measured RTO</li>
            <li>Approval requirements</li>
          </ul>
          <p>
            See <Link href="/docs/execution-plans" className="text-zinc-500">execution plans</Link> (doc coming) for the full lifecycle.
          </p>
        </Step>
      </DocSection>

      <DocSection id="trust" title="What just happened — trust questions" kicker="04 · Self-serve trust">
        <p>
          Every major flow answers the same questions. Here are the answers for the onboarding + first scan flow:
        </p>
        <TrustGrid
          items={[
            { question: "What just happened?", answer: "Axiom assumed a read-only IAM role in your AWS account and enumerated infrastructure across the regions you selected." },
            { question: "What access does Axiom have?", answer: "Read-only: List/Describe/Get on EC2, S3, RDS, IAM, CloudWatch, and a few related services. No write or delete permissions exist in the role." },
            { question: "What does Axiom store?", answer: "Resource metadata (instance type, region, tags) and finding records. We never store access keys, secret material, or contents of buckets/databases." },
            { question: "Can I revoke access?", answer: "Yes — delete the IAM role in your AWS console. Axiom immediately loses all access. We will detect the disconnection and stop attempting to assume." },
            { question: "What happens next?", answer: "Findings + execution plan show in the dashboard. No changes are applied to your infrastructure unless you explicitly approve an execution plan item." },
            { question: "What if it fails?", answer: "Connection tests, scans, and executions all surface an exact failure reason. See troubleshooting for common errors and fixes." },
          ]}
        />
      </DocSection>

      <DocSection id="next" title="Next steps">
        <ul className="space-y-2">
          <li>
            <Link href="/docs/aws-setup" className="text-violet-300 hover:text-violet-200 font-medium">→ AWS setup (deep dive)</Link>
            <span className="text-zinc-500"> · the full policy, permissions explained, and edge cases</span>
          </li>
          <li>
            <Link href="/docs/security-model" className="text-violet-300 hover:text-violet-200 font-medium">→ Security model</Link>
            <span className="text-zinc-500"> · how Axiom isolates tenants, encrypts data, and avoids storing secrets</span>
          </li>
          <li>
            <Link href="/docs/troubleshooting" className="text-violet-300 hover:text-violet-200 font-medium">→ Troubleshooting</Link>
            <span className="text-zinc-500"> · common errors during onboarding and scanning</span>
          </li>
        </ul>
      </DocSection>

      <DocFooterNav
        prev={{ href: "/docs", label: "Documentation overview" }}
        next={{ href: "/docs/aws-setup", label: "AWS setup" }}
      />
      <DocFeedback />
    </>
  );
}
