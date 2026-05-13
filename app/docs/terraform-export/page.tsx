import type { Metadata } from "next";
import Link from "next/link";
import { DocHeader, DocSection, Step, Callout, CodeBlock, TrustGrid, DocFooterNav, DocFeedback } from "@/components/docs/DocPrimitives";

export const metadata: Metadata = {
  title: "Terraform & CLI export — Axiom Documentation",
  description: "Export Axiom-generated Terraform and CLI commands for local review or pipeline-based application. Includes the safety guarantees and review checklist.",
};

export default function TerraformExportPage() {
  return (
    <>
      <DocHeader
        kicker="Operate · Export"
        title="Terraform & CLI export."
        summary="Every Axiom execution plan generates downloadable Terraform you can review locally and apply through your own pipeline. CLI commands are also exported as an alternative."
      />

      <Callout variant="tip" title="When to export instead of letting Axiom apply">
        Export is the right choice when you already have a Terraform pipeline you trust (Atlantis, Terraform Cloud, Spacelift, your own CI), or when policy requires changes to go through specific reviewers in your own VCS workflow.
      </Callout>

      <DocSection id="what" title="What gets exported" kicker="01">
        <p>An execution plan export contains, per phase:</p>
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li><code>main.tf</code> — primary resource definitions with the proposed changes applied</li>
          <li><code>variables.tf</code> — explicit input variables (region, account, tags)</li>
          <li><code>terraform.tfvars</code> — values for those variables, sourced from your scan snapshot</li>
          <li><code>moved.tf</code> — <code>moved {`{}`}</code> blocks if Axiom is renaming or re-addressing resources</li>
          <li><code>README.md</code> — phase summary, blast radius, rollback strategy, RTO, verification criteria</li>
          <li><code>rollback/</code> — a separate Terraform directory that reverts the phase if needed</li>
        </ul>
      </DocSection>

      <DocSection id="cli" title="CLI command export" kicker="02 · Alternative">
        <p>For operations that don&apos;t need IaC (one-shot fixes, irreversible operations like snapshots), Axiom can emit AWS CLI commands instead:</p>
        <CodeBlock language="example · cli export">{`# Phase 1: Pre-flight snapshot
aws ec2 create-snapshot \\
  --volume-id vol-0123456789abcdef0 \\
  --description "axiom-preflight-2026-05-13"

# Phase 2: Right-size i-0a1b2c
aws ec2 stop-instances --instance-ids i-0a1b2c
aws ec2 modify-instance-attribute \\
  --instance-id i-0a1b2c \\
  --instance-type m5.xlarge
aws ec2 start-instances --instance-ids i-0a1b2c

# Phase 3: Verify
aws elbv2 describe-target-health \\
  --target-group-arn $TG_ARN \\
  --targets Id=i-0a1b2c`}</CodeBlock>
      </DocSection>

      <DocSection id="review" title="How to review before applying" kicker="03 · Review checklist">
        <Step number={1} title="Read the README.md">
          <p>Confirms what the phase does, expected impact, rollback strategy, RTO, and verification criteria.</p>
        </Step>
        <Step number={2} title="Run terraform plan locally">
          <p>Use your own AWS credentials. Confirm Terraform&apos;s diff matches Axiom&apos;s reported diff (it should — Axiom&apos;s plan is generated from the same snapshot).</p>
        </Step>
        <Step number={3} title="Verify state alignment">
          <p>If you use Terraform Cloud / Enterprise / S3 backend, Axiom&apos;s export uses a fresh local state. <strong>Either run <code>terraform import</code> for the affected resources or merge into your existing module.</strong> Don&apos;t apply against unaligned state.</p>
        </Step>
        <Step number={4} title="Run the rollback dry-run">
          <p>The <code>rollback/</code> directory has its own plan. Run <code>terraform plan</code> there to confirm rollback can produce the original state.</p>
        </Step>
        <Step number={5} title="Apply through your pipeline">
          <p>Push to your VCS, let your CI/CD apply. After apply, return to Axiom and mark the plan item as &quot;applied externally&quot; — Axiom will trigger post-execution verification.</p>
        </Step>
      </DocSection>

      <DocSection id="local-vs-cloud" title="Local vs. cloud execution" kicker="04">
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li><strong>Local export</strong> — best for one-off review or pipelines you already own. Available today via the dashboard download button.</li>
          <li><strong>Cloud execution</strong> — Axiom applies on your behalf through the execution role. Available today for AWS.</li>
          <li><strong>Desktop execution</strong> — the upcoming desktop app applies <em>locally</em> from your workstation using your own AWS CLI credentials. Preview on macOS; Windows Q2 2026; Linux Q3 2026. See <Link href="/docs/desktop-install" className="text-violet-300 hover:text-violet-200">desktop install</Link>.</li>
        </ul>
      </DocSection>

      <DocSection id="safety" title="Safety warnings" kicker="05">
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li>Don&apos;t apply Axiom&apos;s exported Terraform against state that wasn&apos;t in the original scan. Re-scan if your infrastructure has changed since.</li>
          <li>Don&apos;t merge multiple Axiom-exported plans without reviewing for resource conflicts.</li>
          <li>Rollback Terraform should always be run from the version captured at plan time, not regenerated later.</li>
          <li>For high-risk plan items (broad blast radius), Axiom recommends cloud execution because the rollback timing is more reliable than human-paced pipelines.</li>
        </ul>
      </DocSection>

      <DocSection id="trust" title="Trust questions">
        <TrustGrid
          items={[
            { question: "What is being exported?", answer: "Phase-by-phase Terraform that matches Axiom's proposed changes, plus rollback Terraform and a README." },
            { question: "Why would I export instead of let Axiom apply?", answer: "When you already trust your own pipeline (Atlantis, Terraform Cloud, Spacelift) or policy requires changes to go through your VCS." },
            { question: "Is it safe to run locally?", answer: "Yes, against the snapshot from the original scan. Re-scan if your infrastructure has drifted since." },
            { question: "Does Axiom know I applied?", answer: "Mark the plan item 'applied externally' in the dashboard — Axiom triggers post-execution verification." },
            { question: "What if my pipeline fails?", answer: "Run the rollback/ Terraform from the same export. Same state, same RTO." },
            { question: "Can I see what changed before downloading?", answer: "Yes — every plan shows the full Terraform diff in the dashboard before you click export." },
          ]}
        />
      </DocSection>

      <DocFooterNav
        prev={{ href: "/docs/execution-plans", label: "Execution plans" }}
        next={{ href: "/docs/rollback", label: "Rollback strategy" }}
      />
      <DocFeedback />
    </>
  );
}
