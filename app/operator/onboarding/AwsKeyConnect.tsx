"use client";

/**
 * AWS one-click connect — calm, single-action CloudFormation flow.
 *
 * Five honest states, one primary action at a time:
 *   loading_template → ready → deploying (external) → validating → connected
 *                                                                ↘ failed → restart
 *
 * The customer never sees a Role ARN, access key, or JSON. They click
 * one button per screen. Bounce-back from AWS Console (?roleArn=…
 * &externalId=…) auto-validates and advances.
 *
 * The CFN deep-link uses an S3-hosted templateURL (the platform
 * auto-publishes the YAML to its broker bucket the first time anyone
 * asks). We fetch the URL from /api/aws/quick-deploy-url — AWS Console
 * rejects templateBody URL fragments with "templateURL is required".
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const SS_EXTERNAL_ID = "axiom.aws.externalId";

type Phase =
  | "loading_template"
  | "ready"
  | "deploying"
  | "validating"
  | "connected"
  | "failed";

interface ValidationOk {
  ok: true;
  accountId: string | null;
  arn: string;
  externalId: string;
}
interface ValidationErr {
  ok: false;
  error: string;
  hint?: string;
  brokerArn?: string;
  bucket?: string;
}

// IAM policy the broker user needs to host the CloudFormation template
// in a private S3 bucket. We hand the customer a presigned GET URL —
// no public access is ever set, so no PutBucketPolicy or
// PutPublicAccessBlock perms are needed. Pasting this once unblocks
// every future customer connection.
const BROKER_S3_POLICY = JSON.stringify({
  Version: "2012-10-17",
  Statement: [
    {
      Sid: "ManageOwnQuickCreateTemplateBucket",
      Effect: "Allow",
      Action: ["s3:CreateBucket", "s3:HeadBucket"],
      Resource: "arn:aws:s3:::axiom-cfn-templates-*",
    },
    {
      Sid: "ManageOwnQuickCreateTemplateObject",
      Effect: "Allow",
      Action: ["s3:PutObject", "s3:HeadObject", "s3:GetObject"],
      Resource: "arn:aws:s3:::axiom-cfn-templates-*/axiom-agent-quick-deploy.yaml",
    },
  ],
}, null, 2);

export function AwsKeyConnect({
  onValidated,
  externalId: externalIdProp,
}: {
  onValidated?: (info: { accountId: string | null; roleArn: string; externalId: string }) => void;
  externalId?: string;
}) {
  const params = useSearchParams();
  const urlRoleArn    = params.get("roleArn")    ?? "";
  const urlExternalId = params.get("externalId") ?? "";

  // Stable session externalId. sessionStorage so the CFN trust condition
  // still matches if the customer takes 10 minutes in the AWS Console.
  const [externalId] = useState<string>(() => {
    if (externalIdProp) return externalIdProp;
    if (urlExternalId)  return urlExternalId;
    if (typeof window !== "undefined") {
      const cached = window.sessionStorage.getItem(SS_EXTERNAL_ID);
      if (cached) return cached;
    }
    const cs = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let s = "axiom-";
    for (let i = 0; i < 16; i++) s += cs[Math.floor(Math.random() * cs.length)];
    if (typeof window !== "undefined") window.sessionStorage.setItem(SS_EXTERNAL_ID, s);
    return s;
  });

  const [phase, setPhase]   = useState<Phase>("loading_template");
  const [cfnUrl, setCfnUrl] = useState<string | null>(null);
  const [result, setResult] = useState<ValidationOk | ValidationErr | null>(null);

  // Step A — fetch the CloudFormation Quick-Create URL from the
  // platform (which publishes the template to S3 on first use and
  // returns a console deep-link with templateURL=… filled in).
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/aws/quick-deploy-url?externalId=${encodeURIComponent(externalId)}`)
      .then((r) => r.json())
      .then((data: { available: boolean; url?: string; hint?: string; reason?: string; brokerArn?: string; bucket?: string }) => {
        if (cancelled) return;
        if (data.available && data.url) {
          setCfnUrl(data.url);
          setPhase((p) => (p === "loading_template" ? "ready" : p));
        } else {
          setResult({
            ok: false,
            error: data.reason ?? "template_unavailable",
            hint: data.hint ?? "The platform couldn't prepare the CloudFormation template. Try again in a moment.",
            brokerArn: data.brokerArn,
            bucket: data.bucket,
          });
          setPhase("failed");
        }
      })
      .catch(() => {
        if (!cancelled) setPhase("failed");
      });
    return () => { cancelled = true; };
  }, [externalId]);

  // Step B — bounce-back from CFN: validate the role we just created.
  useEffect(() => {
    if (!urlRoleArn || !urlExternalId) return;
    let cancelled = false;
    setPhase("validating");
    fetch("/api/aws/validate-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roleArn: urlRoleArn, externalId: urlExternalId }),
    })
      .then((r) => r.json())
      .then((data: ValidationOk | ValidationErr) => {
        if (cancelled) return;
        setResult(data);
        if (data.ok) {
          setPhase("connected");
          if (onValidated) onValidated({
            accountId: data.accountId,
            roleArn: data.arn,
            externalId: data.externalId,
          });
        } else {
          setPhase("failed");
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setResult({ ok: false, error: "network_error", hint: err instanceof Error ? err.message : String(err) });
        setPhase("failed");
      });
    return () => { cancelled = true; };
  }, [urlRoleArn, urlExternalId, onValidated]);

  // ─── Connected ──────────────────────────────────────────────────────
  if (phase === "connected" && result?.ok) {
    return (
      <CalmCard tone="emerald">
        <KickerLine tone="emerald">aws · connected</KickerLine>
        <h3 className="text-xl font-semibold text-white tracking-tight mt-1.5">AWS is verified.</h3>
        <p className="text-[13px] text-zinc-300 leading-relaxed mt-2">
          Account <code className="font-mono text-emerald-200">{result.accountId ?? "—"}</code>
          {" "}is connected through the read-only role you just created. We&apos;ll start the inventory in a moment.
        </p>
      </CalmCard>
    );
  }

  // ─── Validating (bounce-back from AWS) ──────────────────────────────
  if (phase === "validating") {
    return (
      <CalmCard tone="indigo">
        <KickerLine tone="indigo">aws · finalizing</KickerLine>
        <h3 className="text-xl font-semibold text-white tracking-tight mt-1.5">Confirming the role…</h3>
        <p className="text-[13px] text-zinc-400 leading-relaxed mt-2">
          AWS just bounced you back. We&apos;re verifying the role can be assumed and that the trust policy is correct. Usually takes a few seconds.
        </p>
        <div className="mt-4 flex items-center gap-2.5">
          <span className="w-4 h-4 rounded-full border-2 border-indigo-300/70 border-t-transparent animate-spin" />
          <span className="text-[13px] text-zinc-300">Calling sts:AssumeRole…</span>
        </div>
      </CalmCard>
    );
  }

  // ─── Failed — calm restart path ─────────────────────────────────────
  if (phase === "failed") {
    const isCfnLoadFail = !cfnUrl;
    const isBrokerPermFix = result?.ok === false && result.error === "broker_s3_perms_missing";

    const retryLoad = () => {
      setResult(null);
      setPhase(cfnUrl ? "ready" : "loading_template");
      if (!cfnUrl) {
        fetch(`/api/aws/quick-deploy-url?externalId=${encodeURIComponent(externalId)}`)
          .then((r) => r.json())
          .then((data: { available: boolean; url?: string; hint?: string; reason?: string; brokerArn?: string; bucket?: string }) => {
            if (data.available && data.url) {
              setCfnUrl(data.url);
              setPhase("ready");
            } else {
              setResult({
                ok: false,
                error: data.reason ?? "template_unavailable",
                hint: data.hint ?? "The platform couldn't prepare the CloudFormation template. Try again in a moment.",
                brokerArn: data.brokerArn,
                bucket: data.bucket,
              });
              setPhase("failed");
            }
          })
          .catch(() => setPhase("failed"));
      }
    };

    // Special case: the platform's broker IAM user is missing the S3
    // permissions needed to host the CloudFormation template. This is
    // a one-time fix the platform owner does — paste the policy below
    // into the broker user, then every future customer connection
    // works without any setup at all.
    if (isBrokerPermFix && result?.ok === false) {
      const brokerArn = result.brokerArn;
      const iamConsoleUrl = brokerArn
        ? `https://us-east-1.console.aws.amazon.com/iam/home?region=us-east-1#/users/details/${encodeURIComponent(brokerArn.split("/").slice(1).join("/"))}?section=permissions`
        : "https://us-east-1.console.aws.amazon.com/iam/home";

      return (
        <PermissionsFixCard
          brokerArn={brokerArn}
          policyJson={BROKER_S3_POLICY}
          iamConsoleUrl={iamConsoleUrl}
          onRetry={retryLoad}
        />
      );
    }

    return (
      <CalmCard tone="amber">
        <KickerLine tone="amber">aws · needs another try</KickerLine>
        <h3 className="text-xl font-semibold text-white tracking-tight mt-1.5">
          {isCfnLoadFail ? "Couldn't load the template." : "AWS didn't accept the role yet."}
        </h3>
        <p className="text-[13px] text-zinc-300 leading-relaxed mt-2">
          {result?.ok === false && result.hint
            ? result.hint
            : "This usually means the CloudFormation stack is still creating. Wait 30 seconds and try the connect button again."}
        </p>
        <button
          type="button"
          onClick={retryLoad}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 text-[13px] font-medium transition-colors"
        >
          Try again
        </button>
      </CalmCard>
    );
  }

  // ─── Ready / loading_template / deploying — primary connect screen ──
  return (
    <div className="space-y-4">
      <CalmCard tone="indigo">
        <KickerLine tone="indigo">aws · one click connect</KickerLine>
        <h3 className="text-xl font-semibold text-white tracking-tight mt-1.5">
          Connect AWS through CloudFormation.
        </h3>
        <p className="text-[13px] text-zinc-300 leading-relaxed mt-2 max-w-2xl">
          We&apos;ll open the AWS Console with a read-only role pre-configured for your session. No JSON, no Role ARN, no access keys — just two clicks in AWS, then you&apos;re back here.
        </p>

        <div className="mt-5">
          {phase === "ready" && cfnUrl ? (
            <a
              href={cfnUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => setPhase("deploying")}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-[14px] font-medium shadow-sm transition-colors"
            >
              Open AWS Console
              <span aria-hidden className="opacity-70">→</span>
            </a>
          ) : phase === "deploying" ? (
            <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-zinc-800/80 border border-zinc-700 text-zinc-200 text-[14px]">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-indigo-300/70 border-t-transparent animate-spin" />
              Waiting for AWS Console…
            </div>
          ) : (
            <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-zinc-800/60 border border-zinc-800 text-zinc-400 text-[14px]">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-zinc-500 border-t-transparent animate-spin" />
              Preparing your connect link…
            </div>
          )}
        </div>
      </CalmCard>

      <CalmCard tone="neutral">
        <KickerLine tone="neutral">what happens next</KickerLine>
        <ol className="mt-3 space-y-3">
          <TimelineStep n={1} title="AWS Console opens">
            The template is pre-filled. Review the role, click <strong className="text-zinc-100">Create stack</strong>.
          </TimelineStep>
          <TimelineStep n={2} title="AWS provisions the role">
            Takes about 30 seconds. The stack&apos;s status moves to <code className="font-mono text-zinc-300">CREATE_COMPLETE</code>.
          </TimelineStep>
          <TimelineStep n={3} title="Click Finish setup">
            In the stack&apos;s <strong className="text-zinc-100">Outputs</strong> tab, click <strong className="text-zinc-100">FinishUrl</strong>. You bounce back here, verified.
          </TimelineStep>
        </ol>
      </CalmCard>

      <CalmCard tone="neutral">
        <KickerLine tone="neutral">what we can see</KickerLine>
        <p className="text-[13px] text-zinc-400 leading-relaxed mt-2">
          The role grants read-only access to inventory and configuration — never to your data, never to write actions.
        </p>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-1.5">
          <ScopeRow>Compute · EC2, autoscaling, load balancers</ScopeRow>
          <ScopeRow>Storage · S3 buckets, configuration, policies</ScopeRow>
          <ScopeRow>Databases · RDS metadata and tags</ScopeRow>
          <ScopeRow>Identity · IAM users, roles, key freshness</ScopeRow>
          <ScopeRow>Metrics · CloudWatch usage signals</ScopeRow>
          <ScopeRow>Cost · Cost Explorer summary</ScopeRow>
        </div>
        <p className="text-[12px] text-zinc-500 leading-relaxed mt-4">
          Sessions are short-lived — one hour, refreshed only when we scan. Delete the CloudFormation stack to revoke instantly.
        </p>
      </CalmCard>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
   Calm visual primitives — shared across this onboarding step so
   every card uses the same rhythm of spacing, kicker, and tone.
   ──────────────────────────────────────────────────────────────────── */

type Tone = "emerald" | "indigo" | "amber" | "neutral";

const TONES: Record<Tone, { border: string; bg: string; kicker: string }> = {
  emerald: {
    border: "border-emerald-500/25",
    bg:     "bg-emerald-500/[0.04]",
    kicker: "text-emerald-300",
  },
  indigo: {
    border: "border-indigo-500/25",
    bg:     "bg-indigo-500/[0.04]",
    kicker: "text-indigo-300",
  },
  amber: {
    border: "border-amber-500/25",
    bg:     "bg-amber-500/[0.04]",
    kicker: "text-amber-300",
  },
  neutral: {
    border: "border-zinc-800",
    bg:     "bg-zinc-900/40",
    kicker: "text-zinc-400",
  },
};

function CalmCard({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const t = TONES[tone];
  return (
    <div className={`rounded-2xl border ${t.border} ${t.bg} p-6`}>
      {children}
    </div>
  );
}

function KickerLine({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const t = TONES[tone];
  return (
    <p className={`text-[10px] font-mono uppercase tracking-[0.22em] font-semibold ${t.kicker}`}>
      {children}
    </p>
  );
}

function TimelineStep({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 text-[11px] font-mono text-zinc-300 flex items-center justify-center mt-[1px]">
        {n}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-zinc-100">{title}</p>
        <p className="text-[12.5px] text-zinc-400 leading-relaxed mt-0.5">{children}</p>
      </div>
    </li>
  );
}

function ScopeRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[12.5px] text-zinc-300">
      <span aria-hidden className="w-1 h-1 rounded-full bg-emerald-400/70 flex-shrink-0" />
      <span>{children}</span>
    </div>
  );
}

/**
 * One-time IAM permissions fix card. Shown when the platform's broker
 * user can't host the CloudFormation template in S3. Operator pastes
 * the policy into the broker user once, every future customer
 * connection then works without setup.
 */
function PermissionsFixCard({
  brokerArn,
  policyJson,
  iamConsoleUrl,
  onRetry,
}: {
  brokerArn?: string;
  policyJson: string;
  iamConsoleUrl: string;
  onRetry: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(policyJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked */ }
  };

  return (
    <div className="space-y-4">
      <CalmCard tone="amber">
        <KickerLine tone="amber">aws · one-time setup</KickerLine>
        <h3 className="text-xl font-semibold text-white tracking-tight mt-1.5">
          The platform&apos;s broker user needs S3 permissions.
        </h3>
        <p className="text-[13px] text-zinc-300 leading-relaxed mt-2 max-w-2xl">
          AWS Console only accepts CloudFormation templates from an S3 URL, so the platform publishes the template to its own bucket. That requires attaching a small inline policy to the broker user{brokerArn ? <> <code className="font-mono text-zinc-100 break-all">{brokerArn}</code></> : null} — once, then it works forever for every customer.
        </p>
      </CalmCard>

      <CalmCard tone="neutral">
        <KickerLine tone="neutral">step 1 — copy this policy</KickerLine>
        <pre className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950 p-3 font-mono text-[11.5px] text-zinc-200 leading-relaxed overflow-x-auto whitespace-pre">
{policyJson}
        </pre>
        <button
          type="button"
          onClick={copy}
          className="mt-3 inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 text-[12.5px] font-medium transition-colors"
        >
          {copied ? "Copied" : "Copy policy"}
        </button>
      </CalmCard>

      <CalmCard tone="neutral">
        <KickerLine tone="neutral">step 2 — attach it to the broker user</KickerLine>
        <ol className="mt-3 space-y-3">
          <TimelineStep n={1} title="Open IAM Console">
            <a href={iamConsoleUrl} target="_blank" rel="noreferrer" className="text-indigo-300 hover:text-indigo-200 transition-colors underline-offset-2 hover:underline">
              Open the broker user&apos;s Permissions tab →
            </a>
          </TimelineStep>
          <TimelineStep n={2} title="Add an inline policy">
            Click <strong className="text-zinc-100">Add permissions → Create inline policy</strong>, switch to the JSON tab, paste what you copied.
          </TimelineStep>
          <TimelineStep n={3} title="Name it and save">
            Call it <code className="font-mono text-zinc-300">AxiomTemplateHosting</code>, click <strong className="text-zinc-100">Create policy</strong>. Done.
          </TimelineStep>
        </ol>
        <div className="mt-5">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-[14px] font-medium shadow-sm transition-colors"
          >
            Try again
            <span aria-hidden className="opacity-70">→</span>
          </button>
        </div>
      </CalmCard>
    </div>
  );
}
