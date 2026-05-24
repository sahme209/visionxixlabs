"use client";

/**
 * AwsKeyConnect — simplest possible AWS connect flow for a customer.
 *
 * No broker, no CloudFormation, no platform-side AWS setup. The
 * customer:
 *   1. Clicks "Open AWS Console → Create user with ReadOnlyAccess"
 *      (deep-link to the IAM Users wizard with the managed policy
 *      pre-selected by AWS's filter).
 *   2. Generates an access key on that user's "Security credentials"
 *      tab (one click in AWS).
 *   3. Pastes Access Key ID + Secret Access Key into the form below.
 *   4. Clicks Validate — we call sts:GetCallerIdentity with their
 *      keys and confirm read-only + report back the account id.
 *
 * No JSON. No Vercel. No broker. No external id. Customer never sees
 * any platform-operator jargon.
 */

import { useState } from "react";

interface ValidationResult {
  ok: true;
  accountId: string | null;
  arn: string | null;
  region: string;
}

interface ValidationError {
  ok: false;
  error: string;
  hint?: string;
}

export function AwsKeyConnect({ onValidated }: { onValidated?: (creds: { accessKeyId: string; secretAccessKey: string; region: string; accountId: string | null }) => void }) {
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [region, setRegion] = useState("us-east-1");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ValidationResult | ValidationError | null>(null);

  const validate = async () => {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/aws/validate-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessKeyId, secretAccessKey, region }),
      });
      const data = (await res.json()) as ValidationResult | ValidationError;
      setResult(data);
      if (data.ok && onValidated) {
        onValidated({ accessKeyId, secretAccessKey, region, accountId: data.accountId });
      }
    } catch (err) {
      setResult({
        ok: false,
        error: "network_error",
        hint: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* 3-step header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StepCard
          num={1}
          title="Create a read-only user"
          body="In AWS Console, add a new IAM user and attach the AWS-managed ReadOnlyAccess policy. Programmatic access only."
          cta={{
            label: "Open AWS Console →",
            href: "https://console.aws.amazon.com/iamv2/home#/users/create",
          }}
        />
        <StepCard
          num={2}
          title="Generate an access key"
          body="On the new user's Security credentials tab, click Create access key → choose 'Third-party service'. AWS shows the secret once."
          cta={{
            label: "AWS docs →",
            href: "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html#Using_CreateAccessKey",
          }}
        />
        <StepCard
          num={3}
          title="Paste the key pair below"
          body="Both values go into the form. We call sts:GetCallerIdentity once to confirm the keys + account; nothing else is touched until you click Scan."
        />
      </div>

      {/* Paste form */}
      <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/[0.04] via-fuchsia-500/[0.02] to-transparent p-5 space-y-4">
        <div className="space-y-2">
          <label className="block text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">Access Key ID</label>
          <input
            type="text"
            value={accessKeyId}
            onChange={(e) => { setAccessKeyId(e.target.value.trim()); setResult(null); }}
            placeholder="AKIA…"
            spellCheck={false}
            autoComplete="off"
            className="w-full px-3 py-2.5 rounded-lg bg-black/40 border border-white/[0.08] focus:border-violet-500/40 focus:outline-none text-[13px] font-mono text-zinc-100 placeholder-zinc-600"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">Secret Access Key</label>
          <input
            type="password"
            value={secretAccessKey}
            onChange={(e) => { setSecretAccessKey(e.target.value.trim()); setResult(null); }}
            placeholder="40-character secret AWS showed you once at key creation"
            spellCheck={false}
            autoComplete="off"
            className="w-full px-3 py-2.5 rounded-lg bg-black/40 border border-white/[0.08] focus:border-violet-500/40 focus:outline-none text-[13px] font-mono text-zinc-100 placeholder-zinc-600"
          />
          <p className="text-[10px] font-mono text-zinc-600">AWS only shows the secret once at creation. If you lost it, generate a new key pair — old one stays revocable from the same panel.</p>
        </div>
        <div className="space-y-2">
          <label className="block text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">Region</label>
          <select
            value={region}
            onChange={(e) => { setRegion(e.target.value); setResult(null); }}
            className="w-full px-3 py-2.5 rounded-lg bg-black/40 border border-white/[0.08] focus:border-violet-500/40 focus:outline-none text-[13px] font-mono text-zinc-100"
          >
            {["us-east-1", "us-east-2", "us-west-1", "us-west-2", "eu-west-1", "eu-central-1", "ap-southeast-1", "ap-southeast-2", "ap-northeast-1"].map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={validate}
          disabled={busy || !accessKeyId || !secretAccessKey}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 disabled:from-zinc-700 disabled:to-zinc-700 disabled:cursor-not-allowed text-white text-[13px] font-semibold shadow-glow-violet transition-all"
        >
          {busy ? (
            <>
              <span className="w-3 h-3 rounded-full border-2 border-white/70 border-t-transparent animate-spin" />
              Validating with AWS…
            </>
          ) : (
            <>Validate connection →</>
          )}
        </button>

        {result?.ok === true && (
          <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] p-3 text-[12px] text-emerald-100">
            <p className="font-semibold text-emerald-200 mb-1">✓ AWS verified — ready to scan</p>
            <p className="text-emerald-100/90 leading-relaxed">
              Account: <code className="font-mono text-emerald-50">{result.accountId ?? "?"}</code><br />
              Caller: <code className="font-mono text-emerald-50 break-all">{result.arn ?? "?"}</code>
            </p>
          </div>
        )}
        {result?.ok === false && (
          <div className="rounded-lg border border-red-500/25 bg-red-500/[0.06] p-3 text-[12px] text-red-100">
            <p className="font-semibold text-red-200 mb-1">✗ {result.error}</p>
            {result.hint && <p className="text-red-100/90 leading-relaxed">{result.hint}</p>}
          </div>
        )}
      </div>

      {/* Safety footer */}
      <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.03] p-4 text-[12px] text-zinc-300 leading-relaxed">
        <p className="text-emerald-200 font-semibold mb-1">Read-only by default · revoke anytime</p>
        <p className="text-zinc-400 max-w-3xl">
          The IAM user you create has the AWS-managed <strong className="text-zinc-200">ReadOnlyAccess</strong> policy, so we can&apos;t write anything to your account.
          To revoke us, deactivate the access key in IAM Console — the next scan returns <code className="font-mono text-zinc-200">access_denied</code> and the connector flips to red.
        </p>
      </div>
    </div>
  );
}

function StepCard({ num, title, body, cta }: { num: number; title: string; body: string; cta?: { label: string; href: string } }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-4 hover:border-white/[0.12] transition-colors space-y-2">
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/20 flex items-center justify-center text-[11px] font-bold text-violet-300">
          {num}
        </span>
        <h3 className="text-[13px] font-semibold text-white">{title}</h3>
      </div>
      <p className="text-[12px] text-zinc-400 leading-relaxed">{body}</p>
      {cta && (
        <a
          href={cta.href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-300 hover:text-violet-200 transition-colors"
        >
          {cta.label}
        </a>
      )}
    </div>
  );
}
