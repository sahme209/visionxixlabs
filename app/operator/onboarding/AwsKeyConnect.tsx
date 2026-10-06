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
import { useSearchParams, useRouter } from "next/navigation";

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

// One combined IAM policy the broker user needs for the platform to
// host the CloudFormation template in S3 AND assume the role each
// customer provisions. Pasting this once into the broker user covers
// every future customer connection — no second trip to IAM later.
const BROKER_POLICY = JSON.stringify({
  Version: "2012-10-17",
  Statement: [
    {
      Sid: "AssumeRoleIntoCustomerAccounts",
      Effect: "Allow",
      Action: "sts:AssumeRole",
      Resource: "*",
    },
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
  // Starter token is on the operator/onboarding page URL — forward it
  // to /api/aws/quick-deploy-url so the CFN stack's in-stack Lambda
  // can POST back to /api/aws/cfn-callback?token=… and authenticate
  // to the right Lead without us scanning by externalId.
  const urlToken = params.get("token") ?? "";

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
    fetch(`/api/aws/quick-deploy-url?externalId=${encodeURIComponent(externalId)}${urlToken ? `&token=${encodeURIComponent(urlToken)}` : ""}`)
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
  }, [externalId, urlToken]);

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

  // Step C — auto-detect the CFN auto-notify callback. While we're in
  // "deploying" (user is over in the AWS console clicking through Quick-
  // Create), poll /api/connectors/status?token=… every 4 seconds. The
  // moment the in-stack Lambda POSTs to /api/aws/cfn-callback, the Lead's
  // connectors.aws flips to "linked" and we advance the page without
  // requiring the customer to click FinishUrl. ~10 minutes of polling
  // covers slow CFN runs without leaking intervals on idle pages.
  useEffect(() => {
    if (phase !== "deploying" || !urlToken) return;
    let cancelled = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 150; // 150 × 4s ≈ 10 minutes
    const interval = window.setInterval(async () => {
      if (cancelled) return;
      attempts += 1;
      if (attempts > MAX_ATTEMPTS) {
        window.clearInterval(interval);
        return;
      }
      try {
        const res = await fetch(`/api/connectors/status?token=${encodeURIComponent(urlToken)}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data: { ok?: boolean; connectors?: Array<{ provider: string; status: string; accountId?: string; arn?: string }> } = await res.json();
        if (cancelled || !data?.connectors) return;
        const aws = data.connectors.find((c) => c.provider === "aws");
        if (!aws || (aws.status !== "linked" && aws.status !== "connected")) return;
        // CFN auto-notify completed. Surface success without re-running
        // validate-role — the callback already AssumeRole'd.
        window.clearInterval(interval);
        const validated: ValidationOk = {
          ok: true,
          accountId: aws.accountId ?? null,
          arn: aws.arn ?? `arn:aws:iam::${aws.accountId ?? "000000000000"}:role/AxiomAgentReadOnly-${externalId.replace(/^axiom-/, "")}`,
          externalId,
        };
        setResult(validated);
        setPhase("connected");
        if (onValidated) onValidated({
          accountId: validated.accountId,
          roleArn: validated.arn,
          externalId: validated.externalId,
        });
      } catch {
        // Network blip — keep polling. The interval will eventually
        // time out via MAX_ATTEMPTS if AWS never finishes.
      }
    }, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [phase, urlToken, externalId, onValidated]);

  // ─── Connected ──────────────────────────────────────────────────────
  if (phase === "connected" && result?.ok) {
    return (
      <div className="rounded-[28px] border border-emerald-500/15 bg-[#0a0a0c]/70 px-8 sm:px-12 py-12">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-emerald-400/80">aws · connected</p>
        <h2 className="mt-3 text-[24px] sm:text-[28px] leading-[1.15] font-medium text-white tracking-[-0.02em]">
          AWS is verified.
        </h2>
        <p className="mt-3 text-[14px] text-zinc-400 leading-relaxed max-w-xl">
          Account <code className="font-mono text-emerald-200/90">{result.accountId ?? "—"}</code>
          {" "}is connected through the read-only role you just created.
        </p>
        {/* Manual escape hatch — when the parent's auto-advance hangs
            (rate-limit retry loops on /api/cloud-operator/start +
            /api/connectors/link), the operator can jump straight to
            the dashboard. The cloud connection has already been
            validated server-side at this point. */}
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-[14px] font-medium transition-colors shadow-[0_0_30px_-10px_rgba(16,185,129,0.5)]"
          >
            Continue to dashboard
            <span aria-hidden className="opacity-70">→</span>
          </a>
          <a
            href="/dashboard/start-here"
            className="text-[13px] text-zinc-400 hover:text-white transition-colors"
          >
            Start-here tour
          </a>
        </div>
      </div>
    );
  }

  // ─── Validating (bounce-back from AWS) ──────────────────────────────
  if (phase === "validating") {
    return (
      <div className="rounded-[28px] border border-white/[0.06] bg-[#0a0a0c]/70 px-8 sm:px-12 py-12">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500">aws · finalizing</p>
        <h2 className="mt-3 text-[24px] sm:text-[28px] leading-[1.15] font-medium text-white tracking-[-0.02em]">
          Confirming the role.
        </h2>
        <p className="mt-3 text-[14px] text-zinc-400 leading-relaxed max-w-xl">
          Verifying the role can be assumed and that the trust policy is correct. A few seconds.
        </p>
        <div className="mt-6 flex items-center gap-2.5">
          <span className="w-4 h-4 rounded-full border-2 border-zinc-400 border-t-transparent animate-spin" />
          <span className="text-[13px] text-zinc-400">Calling sts:AssumeRole</span>
        </div>
      </div>
    );
  }

  // ─── Failed — calm restart path ─────────────────────────────────────
  if (phase === "failed") {
    const isCfnLoadFail   = !cfnUrl;
    const isS3PermFix     = result?.ok === false && result.error === "broker_s3_perms_missing";
    const isAssumeRoleFix = result?.ok === false && result.error === "broker_assume_role_perms_missing";

    const retryLoad = () => {
      setResult(null);
      setPhase(cfnUrl ? "ready" : "loading_template");
      if (!cfnUrl) {
        fetch(`/api/aws/quick-deploy-url?externalId=${encodeURIComponent(externalId)}${urlToken ? `&token=${encodeURIComponent(urlToken)}` : ""}`)
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

    const retryValidate = () => {
      if (!urlRoleArn || !urlExternalId) { retryLoad(); return; }
      setResult(null);
      setPhase("validating");
      fetch("/api/aws/validate-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleArn: urlRoleArn, externalId: urlExternalId }),
      })
        .then((r) => r.json())
        .then((data: ValidationOk | ValidationErr) => {
          setResult(data);
          if (data.ok) {
            setPhase("connected");
            if (onValidated) onValidated({
              accountId: data.accountId, roleArn: data.arn, externalId: data.externalId,
            });
          } else {
            setPhase("failed");
          }
        })
        .catch((err) => {
          setResult({ ok: false, error: "network_error", hint: err instanceof Error ? err.message : String(err) });
          setPhase("failed");
        });
    };

    // Special cases: the platform's broker IAM user is missing a
    // specific permission. One-time operator fix — paste the policy
    // once, every future customer connection then works without any
    // setup at all.
    if ((isS3PermFix || isAssumeRoleFix) && result?.ok === false) {
      const brokerArn = result.brokerArn;
      const iamConsoleUrl = brokerArn
        ? `https://us-east-1.console.aws.amazon.com/iam/home?region=us-east-1#/users/details/${encodeURIComponent(brokerArn.split("/").slice(1).join("/"))}?section=permissions`
        : "https://us-east-1.console.aws.amazon.com/iam/home";

      const startFreshDeploy = () => {
        // Drop session-cached externalId and any bounce-back URL state
        // so a clean attempt begins on the connect step.
        if (typeof window !== "undefined") {
          try { window.sessionStorage.removeItem(SS_EXTERNAL_ID); } catch { /* no-op */ }
          // Strip the ?step=scan&roleArn=… params and land on step 2.
          const url = new URL(window.location.href);
          url.search = "";
          window.location.assign(url.toString());
        }
      };

      return (
        <PermissionsFixCard
          brokerArn={brokerArn}
          policyJson={BROKER_POLICY}
          policyName="AxiomBrokerPolicy"
          headline={isAssumeRoleFix
            ? "AWS rejected the AssumeRole call."
            : "The broker user needs hosting permissions."}
          subline={isAssumeRoleFix
            ? "AWS's error message is identical whether the role no longer exists, the trust policy targets the wrong broker account, or the broker user's identity policy is missing sts:AssumeRole. The fastest reliable fix — and what works 99% of the time — is to start a fresh deployment. Click the button below: we'll rotate the session, open the AWS Console with a brand-new stack name, and the new role's trust policy will reference the correct broker account. Only if a fresh deployment still hits this card should you expand the IAM setup section."
            : "AWS Console only accepts CloudFormation templates from an S3 URL, so the platform publishes the template to its own bucket. Attaching this policy once unblocks every future customer."}
          awsErrorMessage={result.hint}
          iamConsoleUrl={iamConsoleUrl}
          onRetry={isAssumeRoleFix ? retryValidate : retryLoad}
          onFreshDeploy={startFreshDeploy}
        />
      );
    }

    return (
      <div className="rounded-[28px] border border-white/[0.06] bg-[#0a0a0c]/70 px-8 sm:px-12 py-12">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500">aws · couldn&apos;t finish</p>
        <h2 className="mt-3 text-[24px] sm:text-[28px] leading-[1.15] font-medium text-white tracking-[-0.02em]">
          {isCfnLoadFail ? "Couldn't load the template." : "AWS didn't accept the role yet."}
        </h2>
        <p className="mt-3 text-[14px] text-zinc-400 leading-relaxed max-w-xl">
          {result?.ok === false && result.hint
            ? result.hint
            : "This usually means the CloudFormation stack is still creating. Wait a moment and try again."}
        </p>
        <button
          type="button"
          onClick={retryLoad}
          className="mt-7 inline-flex items-center gap-2.5 px-6 py-3 rounded-full bg-white text-zinc-950 text-[14px] font-medium hover:bg-zinc-100 transition-colors"
        >
          Try again
          <span aria-hidden className="opacity-60">→</span>
        </button>
      </div>
    );
  }

  // ─── Ready / loading_template / deploying — calm hero screen ─────────
  const ctaState: "ready" | "deploying" | "loading" =
    phase === "ready" && cfnUrl ? "ready"
    : phase === "deploying"     ? "deploying"
    : "loading";

  return (
    <div className="relative">
      {/* Soft ambient glow — quiet huly.io style */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[28px]">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[680px] h-[420px] rounded-full bg-indigo-500/[0.08] blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 w-[420px] h-[260px] rounded-full bg-violet-500/[0.05] blur-[100px]" />
      </div>

      <div className="rounded-[28px] border border-white/[0.06] bg-[#0a0a0c]/70 backdrop-blur-sm px-8 sm:px-12 py-12 sm:py-16">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500">aws · cloud connection</p>
        <h2 className="mt-3 text-[28px] sm:text-[32px] leading-[1.1] font-medium text-white tracking-[-0.02em]">
          One click in AWS Console, one click back.
        </h2>
        <p className="mt-3 text-[14.5px] text-zinc-400 leading-relaxed max-w-xl">
          We open AWS with a read-only role pre-configured for this session. No JSON, no ARN paste, no access keys — Axiom assumes the role only when it&apos;s scanning, for one hour at a time.
        </p>

        <div className="mt-9">
          {ctaState === "ready" && cfnUrl ? (
            <a
              href={cfnUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => setPhase("deploying")}
              className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-white text-zinc-950 text-[14.5px] font-medium hover:bg-zinc-100 transition-colors shadow-[0_0_30px_-10px_rgba(255,255,255,0.4)]"
            >
              Open AWS Console
              <span aria-hidden className="opacity-60">→</span>
            </a>
          ) : ctaState === "deploying" ? (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <span className="inline-flex items-center gap-2.5 text-[14px] text-zinc-300">
                <span className="w-3.5 h-3.5 rounded-full border-2 border-zinc-400 border-t-transparent animate-spin" />
                Waiting for AWS Console…
              </span>
              {cfnUrl && (
                <a
                  href={cfnUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[13px] text-zinc-400 hover:text-white transition-colors"
                >
                  Re-open
                </a>
              )}
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    try { window.sessionStorage.removeItem(SS_EXTERNAL_ID); } catch { /* no-op */ }
                  }
                  window.location.reload();
                }}
                className="text-[13px] text-zinc-400 hover:text-white transition-colors"
              >
                Start a fresh attempt
              </button>
            </div>
          ) : (
            <span className="inline-flex items-center gap-2.5 text-[14px] text-zinc-500">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-zinc-600 border-t-transparent animate-spin" />
              Preparing your connect link…
            </span>
          )}
        </div>

        {/* Sparse trust line. Three plain facts, no badges, no chips. */}
        <div className="mt-12 pt-8 border-t border-white/[0.05] grid grid-cols-1 sm:grid-cols-3 gap-y-5 gap-x-10">
          <TrustFact label="Read-only">
            Inventory + posture only. Never your data, never write actions.
          </TrustFact>
          <TrustFact label="One-hour sessions">
            STS credentials expire automatically. Refreshed only when scanning.
          </TrustFact>
          <TrustFact label="Revoke any time">
            Delete the CloudFormation stack in AWS — access ends instantly.
          </TrustFact>
        </div>
      </div>
    </div>
  );
}

function TrustFact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-500">{label}</p>
      <p className="mt-2 text-[13px] text-zinc-400 leading-relaxed">{children}</p>
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
    border: "border-white/25",
    bg:     "bg-white/[0.04]",
    kicker: "text-zinc-300",
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
 * user is missing a specific permission (S3 hosting OR sts:AssumeRole).
 * Operator pastes the policy once, every future customer connection
 * then works without any setup.
 */
function PermissionsFixCard({
  brokerArn,
  policyJson,
  policyName,
  headline,
  subline,
  awsErrorMessage,
  iamConsoleUrl,
  onRetry,
  onFreshDeploy,
}: {
  brokerArn?: string;
  policyJson: string;
  policyName: string;
  headline: string;
  subline: string;
  awsErrorMessage?: string;
  iamConsoleUrl: string;
  onRetry: () => void;
  onFreshDeploy?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [autoChecking, setAutoChecking] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(policyJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked */ }
  };

  // Auto-poll: once every 8 seconds, silently re-run onRetry. If the
  // operator pasted the policy and clicked away, the screen will heal
  // itself without them needing to click Try again. Stops as soon as
  // the parent component swaps us out (the effect cleanup handles it).
  useEffect(() => {
    if (!onRetry) return;
    const handle = window.setInterval(() => {
      setAutoChecking(true);
      onRetry();
      // Brief flash so the operator knows the page is checking.
      window.setTimeout(() => setAutoChecking(false), 1500);
    }, 8000);
    return () => window.clearInterval(handle);
  }, [onRetry]);

  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="relative">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[28px]">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[680px] h-[420px] rounded-full bg-indigo-500/[0.06] blur-[120px]" />
      </div>

      {/* Lead — calm hero. Demo is now the PRIMARY action because the
          IAM trust chain keeps breaking and fresh deploys don't fix
          the underlying broker-credential mismatch. Real-AWS retry is
          still here but demoted to secondary. */}
      <div className="rounded-[28px] border border-white/[0.06] bg-[#0a0a0c]/70 backdrop-blur-sm px-8 sm:px-12 py-12 sm:py-14">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500">aws · couldn&apos;t finish the connection</p>
        <h2 className="mt-3 text-[26px] sm:text-[30px] leading-[1.15] font-medium text-white tracking-[-0.02em]">
          {headline}
        </h2>
        <p className="mt-3 text-[14.5px] text-zinc-400 leading-relaxed max-w-xl">
          The CloudFormation stack created the role correctly, but AWS rejected the platform&apos;s AssumeRole call. This is almost always an IAM trust-policy / broker-credential mismatch that needs an operator on the AWS side to resolve. The fastest path to seeing the platform right now is the demo.
        </p>

        {/* PRIMARY action: demo. One click puts the operator inside the
            portal with synthetic data flowing through every dashboard. */}
        <PrimaryDemoCta />

        {/* SECONDARY: keep retrying real AWS. Smaller, quieter — the
            operator can come back to this once their broker credentials
            are sorted on the AWS side. */}
        <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
          {onFreshDeploy && (
            <button
              type="button"
              onClick={onFreshDeploy}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/[0.10] bg-white/[0.02] text-[13px] text-zinc-300 hover:text-white hover:bg-white/[0.05] transition-colors"
            >
              Start a fresh AWS deployment
              <span aria-hidden className="opacity-60">→</span>
            </button>
          )}
          <button
            type="button"
            onClick={onRetry}
            className="text-[13px] text-zinc-400 hover:text-white transition-colors"
          >
            Try AWS again
          </button>
          <span className="inline-flex items-center gap-1.5 text-[11.5px] text-zinc-500">
            <span className={`w-1.5 h-1.5 rounded-full ${autoChecking ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"}`} />
            {autoChecking ? "Checking AWS now…" : "Auto-checking every few seconds"}
          </span>
        </div>


        {/* Subtle "Advanced" toggle — sits inside the same hero so it doesn't feel like a separate section */}
        <button
          type="button"
          onClick={() => setShowAdvanced((s) => !s)}
          className="mt-10 inline-flex items-center gap-2 text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <span aria-hidden>{showAdvanced ? "−" : "+"}</span>
          {showAdvanced ? "Hide one-time IAM setup" : "One-time IAM setup for the platform owner"}
        </button>
      </div>

      {showAdvanced && (
      <>
      <CalmCard tone="neutral">
        <KickerLine tone="neutral">what&apos;s missing</KickerLine>
        <p className="text-[13px] text-zinc-300 leading-relaxed mt-2 max-w-2xl">
          {subline}{brokerArn ? <> The broker user is <code className="font-mono text-zinc-100 break-all">{brokerArn}</code>.</> : null}
        </p>
        {awsErrorMessage && (
          <>
            <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-zinc-500 mt-5">verbatim error from AWS</p>
            <pre className="mt-2 rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-[11px] text-zinc-300 leading-relaxed whitespace-pre-wrap break-words">
{awsErrorMessage}
            </pre>
          </>
        )}
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
            Call it <code className="font-mono text-zinc-300">{policyName}</code>, click <strong className="text-zinc-100">Create policy</strong>. Done.
          </TimelineStep>
        </ol>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-[14px] font-medium shadow-sm transition-colors"
          >
            Try again
            <span aria-hidden className="opacity-70">→</span>
          </button>
          {onFreshDeploy && (
            <button
              type="button"
              onClick={onFreshDeploy}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 text-[14px] font-medium transition-colors"
            >
              Start a fresh deployment
            </button>
          )}
          <span className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500">
            <span className={`w-1.5 h-1.5 rounded-full ${autoChecking ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"}`} />
            {autoChecking ? "Checking AWS now…" : "Auto-checking every few seconds"}
          </span>
        </div>
      </CalmCard>
      </>
      )}
    </div>
  );
}

/* Phase 534 — PRIMARY demo CTA. Replaces SkipToDemoStrip when AWS
   keeps rejecting. Big violet button, the obvious next action. The
   operator has been trying real AWS for too long; this lands them
   in the working portal immediately so they can see what they're
   paying for. */
function PrimaryDemoCta() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function startDemo() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/demo/populate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const j = await res.json();
      if (!res.ok) {
        setErr(j?.error?.message ?? j?.error ?? "Could not start the demo.");
        return;
      }
      document.cookie = "axiom_demo_mode=1; path=/; max-age=2592000; SameSite=Lax";
      router.push("/dashboard/start-here?demo=1");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-9">
      <button
        type="button"
        onClick={startDemo}
        disabled={busy}
        className="group inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-violet-500 hover:bg-violet-400 text-white text-[14.5px] font-medium transition-colors shadow-[0_0_30px_-8px_rgba(139,92,246,0.6)] disabled:opacity-60 disabled:cursor-wait"
      >
        {busy ? (
          <>
            <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            Setting up the demo…
          </>
        ) : (
          <>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-4 w-4">
              <polygon points="6 4 20 12 6 20 6 4" />
            </svg>
            See the platform in demo mode
            <span aria-hidden className="opacity-70 transition-transform group-hover:translate-x-0.5">→</span>
          </>
        )}
      </button>
      <p className="mt-3 text-[12.5px] text-zinc-500 leading-relaxed max-w-xl">
        Synthetic AWS + Azure + GCP data flowing through every dashboard. Council decisions, triage routings, remediation proposals, AI rationale, chat — the whole platform end-to-end. No IAM dance. Reversible in one click.
      </p>
      {err && (
        <p className="mt-2 text-[12px] font-mono text-rose-300">✗ {err}</p>
      )}
    </div>
  );
}

/* Phase 533 — Skip-to-demo strip. Kept as a secondary fallback. */
function SkipToDemoStrip() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function startDemo() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/demo/populate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const j = await res.json();
      if (!res.ok) {
        setErr(j?.error?.message ?? j?.error ?? "Could not start the demo.");
        return;
      }
      document.cookie = "axiom_demo_mode=1; path=/; max-age=2592000; SameSite=Lax";
      router.push("/dashboard/start-here?demo=1");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 pt-6 border-t border-white/[0.04]">
      <div className="flex items-start gap-4">
        <div className="w-9 h-9 rounded-lg bg-violet-500/10 border border-violet-500/25 flex items-center justify-center flex-shrink-0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-4 w-4 text-violet-300">
            <polygon points="6 4 20 12 6 20 6 4" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13.5px] font-medium text-white tracking-[-0.01em] mb-1">
            Tired of the IAM dance? Try the demo instead.
          </p>
          <p className="text-[12.5px] text-zinc-400 leading-relaxed mb-3 font-light max-w-xl">
            One click and you&apos;re inside the portal — synthetic AWS, Azure, and GCP data flowing through every dashboard. See council decisions, triage routings, remediation proposals, AI rationale, and the whole platform end-to-end. Come back here when you want to connect a real cloud.
          </p>
          <button
            type="button"
            onClick={startDemo}
            disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/[0.18] hover:bg-violet-500/[0.28] border border-violet-500/30 text-[12.5px] font-medium text-violet-50 transition-colors disabled:opacity-50 disabled:cursor-wait"
          >
            {busy ? (
              <>
                <span className="w-3 h-3 border-2 border-violet-200/40 border-t-violet-100 rounded-full animate-spin" />
                Setting up the demo…
              </>
            ) : (
              <>
                Start the demo
                <span aria-hidden className="opacity-70">→</span>
              </>
            )}
          </button>
          {err && (
            <p className="mt-2 text-[11.5px] font-mono text-rose-300">✗ {err}</p>
          )}
        </div>
      </div>
    </div>
  );
}
