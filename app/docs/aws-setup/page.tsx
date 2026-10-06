import type { Metadata } from "next";
import Link from "next/link";
import { DocHeader, DocSection, Step, Callout, CodeBlock, TrustGrid, DocFooterNav, DocFeedback } from "@/components/docs/DocPrimitives";

export const metadata: Metadata = {
  title: "AWS setup — Axiom Documentation",
  description: "Connect your AWS account to Axiom via a read-only IAM role with External ID. Full policy, what each permission does, and what Axiom can and cannot do.",
};

const POLICY_DOC = `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AxiomReadOnlyOps",
      "Effect": "Allow",
      "Action": [
        "ec2:Describe*",
        "s3:GetBucket*",
        "s3:ListBucket",
        "s3:ListAllMyBuckets",
        "rds:Describe*",
        "rds:ListTagsForResource",
        "iam:Get*",
        "iam:List*",
        "iam:Simulate*",
        "cloudwatch:Get*",
        "cloudwatch:List*",
        "cloudwatch:Describe*",
        "logs:Describe*",
        "logs:Get*",
        "logs:List*",
        "ce:Get*",
        "ce:List*",
        "sts:GetCallerIdentity",
        "tag:GetResources"
      ],
      "Resource": "*"
    }
  ]
}`;

const TRUST_POLICY = `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "AWS": "arn:aws:iam::AXIOM_ACCOUNT_ID:root" },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": {
          "sts:ExternalId": "YOUR_EXTERNAL_ID_HERE"
        }
      }
    }
  ]
}`;

export default function AwsSetupPage() {
  return (
    <>
      <DocHeader
        kicker="Connect a cloud · AWS"
        title="AWS setup — IAM role + External ID."
        summary="Axiom connects to your AWS account by assuming a read-only IAM role. You create the role; Axiom never sees access keys, never stores credentials, and only ever has the permissions you explicitly grant."
      />

      <Callout variant="safe" title="The model: assume-role, read-only, External-ID-bound">
        Axiom runs in our AWS account and assumes a role in <strong>your</strong> AWS account. The role&apos;s trust policy requires a unique External ID we generate per connection — preventing confused-deputy attacks. The role&apos;s permission policy contains only <code>Describe</code>, <code>Get</code>, and <code>List</code> actions. No write, no delete, no modify.
      </Callout>

      <DocSection id="overview" title="How the connection works" kicker="00 · Overview">
        <p>The full handshake when Axiom assumes the role:</p>
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li>You create a role in your account with our trust policy (Axiom AWS account + your External ID)</li>
          <li>You attach the read-only permission policy (below)</li>
          <li>You paste the Role ARN into Axiom</li>
          <li>Axiom calls <code>sts:AssumeRole</code> with the External ID — only succeeds if both match</li>
          <li>Axiom receives temporary credentials valid for 1 hour, used only for the scan</li>
          <li>When credentials expire, they are discarded — never persisted</li>
        </ul>
      </DocSection>

      <DocSection id="option-1" title="Option 1 — One-click CloudFormation (recommended)" kicker="01">
        <Step number={1} title="From the Axiom onboarding wizard">
          <p>
            On the AWS step, click <strong>Launch with CloudFormation</strong>. This opens the AWS Console pre-filled with our stack template.
          </p>
        </Step>
        <Step number={2} title="Review the stack — accept the IAM acknowledgment">
          <p>
            The stack creates exactly one IAM role with the trust policy and the read-only permission policy. The template is published — you can review it before deploying.
          </p>
        </Step>
        <Step number={3} title="Copy the Role ARN output back to Axiom">
          <p>
            After the stack creates (~30 seconds), copy the <code>AxiomAgentRoleArn</code> output and paste it into the Axiom onboarding wizard. Hit <strong>Test connection</strong>.
          </p>
        </Step>
      </DocSection>

      <DocSection id="option-2" title="Option 2 — Manual IAM role creation" kicker="02">
        <p>If your organization disallows CloudFormation auto-deploys, create the role manually:</p>

        <Step number={1} title="Open AWS IAM Console → Roles → Create role">
          <p>Choose <strong>Custom trust policy</strong> and paste:</p>
          <CodeBlock language="trust policy">{TRUST_POLICY}</CodeBlock>
          <p className="text-xs text-zinc-500">
            Replace <code>AXIOM_ACCOUNT_ID</code> and <code>YOUR_EXTERNAL_ID_HERE</code> with the values shown in the Axiom onboarding screen.
          </p>
        </Step>
        <Step number={2} title="Attach the permission policy">
          <p>Create an inline policy on the role:</p>
          <CodeBlock language="permission policy">{POLICY_DOC}</CodeBlock>
        </Step>
        <Step number={3} title="Name and create">
          <p>
            Suggested role name: <code>axiom-agent-role</code>. Maximum session duration: <code>1 hour</code> is sufficient.
          </p>
        </Step>
        <Step number={4} title="Copy the Role ARN and paste into Axiom">
          <p>
            From the role&apos;s summary page in IAM, copy the ARN (looks like <code>arn:aws:iam::123456789012:role/axiom-agent-role</code>) and paste into Axiom. Test the connection.
          </p>
        </Step>
      </DocSection>

      <DocSection id="permissions-explained" title="What each permission does" kicker="03 · Why each line">
        <p>Every action in the policy maps to a specific Axiom capability. Nothing is requested speculatively.</p>
        <ul className="space-y-2 text-sm">
          {[
            { perm: "ec2:Describe*", reason: "Enumerate EC2 instances, volumes, security groups, VPCs, NAT gateways, ELBs for inventory + rightsizing." },
            { perm: "s3:GetBucket* / ListBucket", reason: "Detect public buckets, encryption settings, lifecycle rules, versioning posture. We never read object contents." },
            { perm: "rds:Describe* / ListTagsForResource", reason: "Inventory RDS instances and clusters; identify oversized DBs, missing backups, unencrypted instances." },
            { perm: "iam:Get* / List* / Simulate*", reason: "Audit IAM roles, policies, and trust relationships for over-permissive grants. Simulate is read-only policy analysis." },
            { perm: "cloudwatch:Get* / List* / Describe*", reason: "Pull utilization metrics for rightsizing recommendations." },
            { perm: "logs:Describe* / Get* / List*", reason: "Detect missing or stale log groups, retention misconfigurations." },
            { perm: "ce:Get* / List*", reason: "Cost Explorer signals — used to validate that cost optimizations land in your actual bill." },
            { perm: "sts:GetCallerIdentity", reason: "Confirms successful role assumption during the connection test." },
            { perm: "tag:GetResources", reason: "Aggregate cross-service tag inventory for ownership graphs." },
          ].map((row) => (
            <li key={row.perm} className="rounded-lg bg-white/[0.02] border border-white/[0.04] p-3">
              <p className="text-zinc-300 font-mono text-[12px] mb-1">{row.perm}</p>
              <p className="text-xs text-zinc-500">{row.reason}</p>
            </li>
          ))}
        </ul>
      </DocSection>

      <DocSection id="not-permitted" title="What Axiom cannot do with this role" kicker="04 · Hard guarantees">
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li>Create, modify, or delete any resource</li>
          <li>Read object content in S3 buckets (only metadata — encryption, ACL, lifecycle)</li>
          <li>Read database row contents in RDS (only configuration metadata)</li>
          <li>Decrypt secrets in Secrets Manager or KMS</li>
          <li>Modify IAM policies, users, roles, or permission boundaries</li>
          <li>Launch, stop, or modify EC2 instances</li>
          <li>Access CloudTrail data history (only configuration)</li>
        </ul>
        <p>
          For execution flows (Agent tier and above), Axiom uses a <em>separate</em>, more-scoped role that you create per-action — never the read-only scan role. See <Link href="/docs/permissions-model" className="text-zinc-500">permissions model</Link> (doc coming).
        </p>
      </DocSection>

      <DocSection id="trust" title="Trust questions" kicker="05 · Self-serve trust">
        <TrustGrid
          items={[
            { question: "Why External ID?", answer: "Prevents confused-deputy: another Axiom customer cannot trick our service into assuming your role. Each connection gets a unique External ID; nobody can guess it." },
            { question: "What if I lose the External ID?", answer: "It's stored on the Axiom side per connection. Rotate by deleting the connection and re-onboarding — the trust policy updates with a new ID." },
            { question: "Does Axiom store my Role ARN?", answer: "Yes, encrypted at rest. It's needed to assume the role each scan. The ARN by itself grants nothing — assumption requires our AWS account + your External ID." },
            { question: "Can I limit which regions Axiom sees?", answer: "Yes. The onboarding wizard lets you select regions. You can also add an explicit Condition block on the trust policy to limit by AWS Region." },
            { question: "What if my org requires SCPs?", answer: "Service Control Policies are fully compatible. The role inherits SCP constraints automatically. If an SCP blocks a Describe action, that resource simply won't appear in scans." },
            { question: "How do I revoke?", answer: "Delete the IAM role in your AWS console. Axiom immediately loses all access on the next assume attempt. Connection state in Axiom dashboard flips to 'disconnected' within seconds." },
          ]}
        />
      </DocSection>

      <DocSection id="troubleshooting" title="Common errors during AWS setup" kicker="06 · Troubleshooting">
        <ul className="space-y-3">
          {[
            { code: "AccessDenied (sts:AssumeRole)", fix: "Trust policy is missing or has wrong Axiom account ID. Recopy the trust policy from the onboarding screen." },
            { code: "InvalidExternalId", fix: "External ID in the trust policy condition doesn't match what Axiom sent. Re-paste from the onboarding screen exactly." },
            { code: "MalformedPolicyDocumentException", fix: "JSON syntax error in the trust or permission policy. Use AWS Console's built-in validator before saving." },
            { code: "Empty scan result", fix: "Either the role has no permission to describe resources, or no resources exist in the selected regions. Verify with sts:GetCallerIdentity in CloudShell." },
          ].map((row) => (
            <li key={row.code} className="rounded-lg bg-white/[0.02] border border-white/[0.04] p-3">
              <p className="text-zinc-400 font-mono text-[12px] mb-1">{row.code}</p>
              <p className="text-xs text-zinc-400">{row.fix}</p>
            </li>
          ))}
        </ul>
        <p>
          See the full <Link href="/docs/troubleshooting" className="text-violet-300 hover:text-violet-200">troubleshooting guide</Link> for additional scenarios.
        </p>
      </DocSection>

      <DocFooterNav
        prev={{ href: "/docs/getting-started", label: "Getting started" }}
        next={{ href: "/docs/security-model", label: "Security model" }}
      />
      <DocFeedback />
    </>
  );
}
