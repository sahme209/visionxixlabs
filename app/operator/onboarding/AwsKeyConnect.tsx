"use client";

/**
 * AWS one-click connect — pure CloudFormation flow.
 *
 * Customer experience (3 clicks total, no copy-paste):
 *   1. Click "Deploy via CloudFormation (1 click)" on this page.
 *   2. AWS Console opens with our template + ExternalId pre-filled.
 *      Click "Create stack". AWS provisions the read-only role.
 *   3. Click the "Finish setup" link in the stack's Outputs tab —
 *      bounces back here with ?roleArn=…&accountId=…&externalId=…
 *      pre-filled in the URL. We auto-validate + advance to scan.
 *
 * No JSON copy-paste. No Role ARN pasting. No access keys. No broker
 * mention. No Vercel mention. No platform-operator jargon anywhere.
 *
 * Why the template is inlined (templateBody) instead of S3-hosted:
 *   AWS Console's Quick-Create deep-link rejects non-S3 templateURL
 *   values. The "Create stack" review wizard accepts a templateBody
 *   URL fragment param — we inline the ~4KB YAML directly, which
 *   removes the need for any platform-side S3 hosting.
 *
 * On return (URL has ?roleArn=…), we auto-validate by calling
 * sts:AssumeRole via the platform's backend. If the platform isn't
 * fully configured server-side, the validate endpoint returns a
 * "service_unavailable" message that we surface honestly without
 * leaking operator-side env-var names.
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const AWS_REGION = "us-east-1";
const STACK_NAME = "axiom-agent";

interface ValidationResult {
  ok: true;
  accountId: string | null;
  arn: string;
  externalId: string;
}
interface ValidationError {
  ok: false;
  error: string;
  hint?: string;
}

export function AwsKeyConnect({
  onValidated,
  externalId: externalIdProp,
}: {
  onValidated?: (info: { accountId: string | null; roleArn: string; externalId: string }) => void;
  externalId?: string;
}) {
  const params = useSearchParams();
  // Auto-fill from CFN bounce-back URL params.
  const urlRoleArn    = params.get("roleArn")    ?? "";
  const urlAccountId  = params.get("accountId")  ?? "";
  const urlExternalId = params.get("externalId") ?? "";

  // Generate or accept a session externalId so the CFN template's
  // sts:ExternalId condition matches what we expect at scan time.
  const [externalId] = useState<string>(() => {
    if (externalIdProp) return externalIdProp;
    if (urlExternalId)  return urlExternalId;
    const cs = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let s = "axiom-";
    for (let i = 0; i < 16; i++) s += cs[Math.floor(Math.random() * cs.length)];
    return s;
  });

  const [cfnUrl, setCfnUrl] = useState<string | null>(null);
  const [result, setResult] = useState<ValidationResult | ValidationError | null>(null);
  const [busy, setBusy]     = useState<"none" | "loading_template" | "validating">("loading_template");

  // Step A: fetch the template YAML + build a one-click URL with the
  // template body inlined. No S3 required.
  useEffect(() => {
    let cancelled = false;
    fetch("/aws/axiom-agent-quick-deploy.yaml")
      .then((r) => r.text())
      .then((yaml) => {
        if (cancelled) return;
        const qs = new URLSearchParams({
          stackName: STACK_NAME,
          templateBody: yaml,
          param_ExternalId: externalId,
        });
        const url = `https://${AWS_REGION}.console.aws.amazon.com/cloudformation/home?region=${AWS_REGION}#/stacks/create/review?${qs.toString()}`;
        setCfnUrl(url);
        setBusy("none");
      })
      .catch(() => {
        if (!cancelled) {
          setCfnUrl(null);
          setBusy("none");
        }
      });
    return () => { cancelled = true; };
  }, [externalId]);

  // Step B: if we landed back with ?roleArn=…&externalId=…, auto-validate.
  useEffect(() => {
    if (!urlRoleArn || !urlExternalId) return;
    let cancelled = false;
    setBusy("validating");
    fetch("/api/aws/validate-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roleArn: urlRoleArn, externalId: urlExternalId }),
    })
      .then((r) => r.json())
      .then((data: ValidationResult | ValidationError) => {
        if (cancelled) return;
        setResult(data);
        setBusy("none");
        if (data.ok && onValidated) {
          onValidated({ accountId: data.accountId, roleArn: data.arn, externalId: data.externalId });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setResult({ ok: false, error: "network_error", hint: err instanceof Error ? err.message : String(err) });
        setBusy("none");
      });
    return () => { cancelled = true; };
  }, [urlRoleArn, urlExternalId, onValidated]);

  // ─── RETURN: just validated case ─────────────────────────────────
  if (result?.ok === true) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.10] via-emerald-500/[0.04] to-transparent p-6 space-y-3">
        <p className="text-[10px] font-mono uppercase tracking-[0.22em] font-semibold text-emerald-300">aws · connected</p>
        <h3 className="text-xl font-bold text-white tracking-tight">AWS verified — starting your scan…</h3>
        <p className="text-[13px] text-zinc-300 leading-relaxed">
          Account <code className="font-mono text-emerald-200">{result.accountId ?? "?"}</code> is connected via the
          read-only role you just created. We&apos;ll show your inventory in a moment.
        </p>
      </div>
    );
  }

  // ─── VALIDATING case (just returned from CFN) ────────────────────
  if (busy === "validating") {
    return (
      <div className="rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-500/[0.08] via-fuchsia-500/[0.04] to-transparent p-6 space-y-3">
        <p className="text-[10px] font-mono uppercase tracking-[0.22em] font-semibold text-violet-300">aws · finalizing</p>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-full border-2 border-violet-200 border-t-transparent animate-spin" />
          <span className="text-[14px] text-zinc-200">Validating the role you just created…</span>
        </div>
        {urlRoleArn && (
          <p className="text-[10px] font-mono text-zinc-500 truncate">{urlRoleArn}</p>
        )}
      </div>
    );
  }

  // ─── PRIMARY case: show the 1-click button. ──────────────────────
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/[0.12] via-fuchsia-500/[0.06] to-amber-500/[0.04] p-6 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-violet-500/20 blur-[60px] pointer-events-none" aria-hidden />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-fuchsia-500/15 blur-[60px] pointer-events-none" aria-hidden />
        <div className="relative space-y-4">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.22em] font-semibold text-violet-300 mb-2">★ one click</p>
            <h3 className="text-xl font-bold text-white tracking-tight mb-1">Connect AWS via CloudFormation.</h3>
            <p className="text-[13px] text-zinc-300 leading-relaxed max-w-2xl">
              Opens AWS Console with a read-only IAM role pre-configured. Click <strong className="text-zinc-100">Create stack</strong> in AWS,
              then click the <strong className="text-zinc-100">Finish setup</strong> link in the stack&apos;s outputs to come right back here — fully connected. No copy-paste.
            </p>
          </div>

          {cfnUrl ? (
            <a
              href={cfnUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-[14px] font-semibold shadow-glow-violet transition-all"
            >
              🚀 Deploy via CloudFormation (1 click) →
            </a>
          ) : busy === "loading_template" ? (
            <span className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-violet-600/30 text-violet-100/80 text-[14px] font-semibold cursor-wait">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-violet-200 border-t-transparent animate-spin" />
              Preparing 1-click link…
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-zinc-800 text-zinc-400 text-[14px] font-semibold cursor-not-allowed">
              Template unavailable — try again
            </span>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2 text-[11px] text-zinc-400">
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Trust policy pre-filled</span>
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Read-only permissions</span>
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> No JSON to copy</span>
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Revoke = delete stack</span>
          </div>
        </div>
      </div>

      {/* If validation failed (from a previous bounce-back) — surface honestly */}
      {result?.ok === false && (
        <div className="rounded-xl border border-red-500/25 bg-red-500/[0.06] p-3 text-[12px] text-red-100">
          <p className="font-semibold text-red-200 mb-1">Validation failed — {result.error}</p>
          {result.hint && <p className="text-red-100/90 leading-relaxed">{result.hint}</p>}
        </div>
      )}

      {/* Safety footer — calm, honest */}
      <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.03] p-4 text-[12px] text-zinc-300 leading-relaxed">
        <p className="text-emerald-200 font-semibold mb-1">Read-only by default · revoke anytime</p>
        <p className="text-zinc-400 max-w-3xl">
          The CloudFormation stack creates an IAM role with the AWS-managed <strong className="text-zinc-200">ReadOnlyAccess</strong>{" "}
          set of actions. We never see your access keys — AssumeRole gives short-lived (1-hour) credentials. Delete the stack from
          CloudFormation to revoke instantly.
        </p>
      </div>
    </div>
  );
}
