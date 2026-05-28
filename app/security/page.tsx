"use client";

import Link from "next/link";
import {
  ShieldCheckIcon,
  LockClosedIcon,
  EyeSlashIcon,
  TrashIcon,
  ServerStackIcon,
  ClockIcon,
  KeyIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";
import { Navigation } from "../../components/Navigation";

const AWS_BROKER_ACCOUNT_ID = "590183704419";

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-dots opacity-10 pointer-events-none" aria-hidden />
      {/* Huly aurora */}
      <div className="ambient-drift absolute -top-40 right-0 w-[480px] h-[480px] rounded-full bg-brand-violet/[0.08] blur-[130px] pointer-events-none" aria-hidden />
      <div className="ambient-drift absolute top-1/4 left-1/4 w-[420px] h-[340px] rounded-full bg-brand-coral/[0.06] blur-[120px] pointer-events-none" style={{ animationDelay: "-8s" }} aria-hidden />
      <div className="ambient-drift absolute bottom-0 -left-40 w-[420px] h-[360px] rounded-full bg-emerald-500/[0.05] blur-[120px] pointer-events-none" style={{ animationDelay: "-14s" }} aria-hidden />
      <Navigation />

      <div className="max-w-6xl mx-auto px-6 md:px-10 pt-32 pb-16">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-8 md:p-12">
          {/* Header — Huly numbered + coral underline */}
          <div className="mb-12">
            <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-4 inline-flex items-center gap-3">
              <span className="text-brand-coral/90 tabular-nums">S1</span>
              <span className="h-px w-6 bg-gradient-to-r from-brand-coral/60 to-transparent" />
              Security
            </p>
            <div className="flex items-start gap-4 mb-4">
              <div className="shrink-0 w-12 h-12 rounded-xl border border-brand-coral/30 bg-gradient-to-br from-brand-coral/15 to-brand-violet/15 flex items-center justify-center">
                <ShieldCheckIcon className="h-6 w-6 text-brand-coral" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold tracking-[-0.04em] leading-[1.04]">
                Read-only.{" "}
                <span className="relative inline-block">
                  Revocable.
                  <span aria-hidden className="absolute left-0 -bottom-1 h-[3px] w-full rounded-full bg-gradient-to-r from-brand-coral via-fuchsia-400 to-transparent opacity-85" />
                </span>
              </h1>
            </div>
            <p className="text-lg text-zinc-400 max-w-2xl">
              How we connect to your cloud, what we can see, and what we do with
              your data. No marketing — just the technical details.
            </p>
          </div>

          {/* TL;DR */}
          <section className="mb-10 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20 p-6">
            <h2 className="text-lg font-bold text-emerald-300 mb-3">
              TL;DR
            </h2>
            <ul className="space-y-2 text-sm text-emerald-300">
              <li>
                <strong>Read-only access.</strong> We cannot modify, delete, or
                write anything in your AWS account.
              </li>
              <li>
                <strong>3 API permissions.</strong> We call{" "}
                <code className="bg-emerald-500/10 px-1 rounded text-xs">
                  ec2:Describe*
                </code>
                ,{" "}
                <code className="bg-emerald-500/10 px-1 rounded text-xs">
                  s3:ListAllMyBuckets
                </code>
                , and{" "}
                <code className="bg-emerald-500/10 px-1 rounded text-xs">
                  sts:GetCallerIdentity
                </code>
                . Nothing else.
              </li>
              <li>
                <strong>No stored credentials.</strong> We use AWS STS
                AssumeRole with 15-minute session tokens. No access keys are
                stored.
              </li>
              <li>
                <strong>You can revoke access in 10 seconds</strong> by deleting
                the IAM role from your AWS console.
              </li>
            </ul>
          </section>

          {/* How AWS connection works */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <KeyIcon className="h-6 w-6 text-zinc-400" />
              <h2 className="text-2xl font-bold">
                How AWS connection works
              </h2>
            </div>
            <p className="text-zinc-300 leading-relaxed mb-4">
              We use the industry-standard{" "}
              <strong>cross-account AssumeRole</strong> pattern. This is the
              same mechanism used by AWS organizations, Datadog, Prisma Cloud,
              and every major cloud tool.
            </p>
            <div className="space-y-4">
              {[
                {
                  step: "1",
                  title: "You create an IAM role in your account",
                  desc: <>The role trusts our broker account (<code className="bg-white/[0.06] px-1 rounded text-xs">{AWS_BROKER_ACCOUNT_ID}</code>) with a unique External ID tied to your session. This prevents{" "}<a href="https://docs.aws.amazon.com/IAM/latest/UserGuide/confused-deputy.html" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 underline">confused deputy attacks</a>.</>,
                },
                {
                  step: "2",
                  title: "We assume the role with a 15-minute session",
                  desc: <>Our broker calls <code className="bg-white/[0.06] px-1 rounded text-xs">sts:AssumeRole</code> with DurationSeconds=900 (15 minutes). The temporary credentials expire automatically.</>,
                },
                {
                  step: "3",
                  title: "We run read-only API calls",
                  desc: "Count EC2 instances, list S3 bucket names, verify account identity. We cannot read bucket contents, modify resources, or access any other service.",
                },
                {
                  step: "4",
                  title: "Session expires, credentials are discarded",
                  desc: "After the scan completes, the temporary STS token expires. We do not cache or persist AWS credentials.",
                },
              ].map((item) => (
                <div key={item.step} className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-500/10 flex items-center justify-center text-sm font-bold text-violet-400">
                    {item.step}
                  </div>
                  <div>
                    <p className="font-semibold text-white">{item.title}</p>
                    <p className="text-sm text-zinc-400">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Exact permissions */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <EyeSlashIcon className="h-6 w-6 text-zinc-400" />
              <h2 className="text-2xl font-bold">
                Exact permissions we request
              </h2>
            </div>
            <div className="rounded-xl border border-white/[0.06] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                    <th className="text-left px-4 py-3 font-semibold text-zinc-300">Permission</th>
                    <th className="text-left px-4 py-3 font-semibold text-zinc-300">What it does</th>
                    <th className="text-left px-4 py-3 font-semibold text-zinc-300">What it cannot do</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-white/[0.04]">
                    <td className="px-4 py-3 font-mono text-xs text-violet-400">ec2:Describe*</td>
                    <td className="px-4 py-3 text-zinc-400">Count instances, list regions, read instance metadata</td>
                    <td className="px-4 py-3 text-zinc-400">Cannot start, stop, terminate, or modify any instance</td>
                  </tr>
                  <tr className="border-t border-white/[0.04]">
                    <td className="px-4 py-3 font-mono text-xs text-violet-400">s3:ListAllMyBuckets</td>
                    <td className="px-4 py-3 text-zinc-400">Count bucket names</td>
                    <td className="px-4 py-3 text-zinc-400">Cannot read, download, delete, or list objects inside any bucket</td>
                  </tr>
                  <tr className="border-t border-white/[0.04]">
                    <td className="px-4 py-3 font-mono text-xs text-violet-400">sts:GetCallerIdentity</td>
                    <td className="px-4 py-3 text-zinc-400">Verify we are in your account (returns account ID and ARN)</td>
                    <td className="px-4 py-3 text-zinc-400">Cannot assume other roles or escalate privileges</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-zinc-500">
              You can verify every API call we make by checking your{" "}
              <strong>CloudTrail</strong> logs.
            </p>
          </section>

          {/* What we store */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <ServerStackIcon className="h-6 w-6 text-zinc-400" />
              <h2 className="text-2xl font-bold">What we store</h2>
            </div>
            <div className="space-y-4">
              {[
                { title: "Scan results", desc: "Instance count, bucket count, region list, risk flags, and generated insights. Stored as JSON attached to your session record. No raw AWS API responses are persisted." },
                { title: "Scan history", desc: "Up to 5 previous scan snapshots for trend comparison. Older snapshots are automatically dropped." },
                { title: "IAM Role ARN", desc: "The Role ARN and External ID you provided, encrypted at rest using AES-256-GCM. Used to re-assume the role for subsequent scans. Deleted when you disconnect." },
              ].map((item) => (
                <div key={item.title} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
                  <p className="font-semibold text-white mb-1">{item.title}</p>
                  <p className="text-sm text-zinc-400">{item.desc}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-lg bg-red-500/[0.06] border border-red-500/20 p-4">
              <p className="font-semibold text-red-300 mb-1">What we never store</p>
              <ul className="text-sm text-red-400 space-y-1">
                <li>- AWS access keys, secret keys, or session tokens</li>
                <li>- Contents of S3 buckets or EBS volumes</li>
                <li>- Application logs, environment variables, or secrets</li>
                <li>- IAM user credentials or root account information</li>
              </ul>
            </div>
          </section>

          {/* Data retention */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <ClockIcon className="h-6 w-6 text-zinc-400" />
              <h2 className="text-2xl font-bold">Data retention</h2>
            </div>
            <div className="rounded-xl border border-white/[0.06] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                    <th className="text-left px-4 py-3 font-semibold text-zinc-300">Data type</th>
                    <th className="text-left px-4 py-3 font-semibold text-zinc-300">Retention</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { type: "Scan results & insights", retention: "While your account is active. Deleted on request." },
                    { type: "Scan history (comparisons)", retention: "Last 5 snapshots. Oldest auto-deleted." },
                    { type: "Encrypted Role ARN", retention: "Until you disconnect. Immediately deleted on disconnect." },
                    { type: "STS session tokens", retention: "Never stored. Used in-memory only. Expire after 15 minutes automatically." },
                  ].map((row, i) => (
                    <tr key={row.type} className="border-t border-white/[0.04]">
                      <td className="px-4 py-3 text-zinc-300">{row.type}</td>
                      <td className="px-4 py-3 text-zinc-400">{row.retention}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* How to revoke */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <TrashIcon className="h-6 w-6 text-zinc-400" />
              <h2 className="text-2xl font-bold">How to revoke access</h2>
            </div>
            <p className="text-zinc-300 leading-relaxed mb-4">
              Delete the IAM role from your AWS account. That&apos;s it. We can
              no longer assume the role and all future scan attempts will fail.
            </p>
            <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-4">
              <p className="text-sm font-mono text-zinc-300 mb-2">
                AWS Console &rarr; IAM &rarr; Roles &rarr; Find the
                CloudOperator role &rarr; Delete
              </p>
              <p className="text-sm text-zinc-500">
                Or via CLI:{" "}
                <code className="bg-white/[0.06] px-1.5 py-0.5 rounded text-xs">
                  aws iam delete-role --role-name CloudOperatorReadOnly
                </code>
              </p>
            </div>
          </section>

          {/* Compliance */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <LockClosedIcon className="h-6 w-6 text-zinc-400" />
              <h2 className="text-2xl font-bold">Compliance &amp; certifications</h2>
            </div>
            <p className="text-zinc-300 leading-relaxed mb-4">
              We are transparent about where we are in our compliance journey:
            </p>
            <ul className="space-y-2 text-sm text-zinc-300">
              <li><strong>Encryption:</strong> TLS 1.2+ in transit. AES-256-GCM at rest for credential storage.</li>
              <li><strong>Infrastructure:</strong> Hosted on Vercel (SOC2 certified) with PostgreSQL on managed infrastructure.</li>
              <li><strong>DPA:</strong> Available for enterprise clients on request.</li>
              <li><strong>SOC2 / ISO 27001:</strong> Not yet certified. We follow SOC2-aligned practices (least privilege, audit logging, encryption at rest) and will pursue formal certification as we scale.</li>
            </ul>
          </section>

          {/* Verify us */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4">Verify our claims</h2>
            <p className="text-zinc-300 leading-relaxed mb-3">
              You don&apos;t have to trust our word. Here&apos;s how to verify independently:
            </p>
            <ul className="space-y-2 text-sm text-zinc-300">
              <li>
                <strong>CloudTrail:</strong> Check your CloudTrail Event History for all API calls made by the assumed role. You&apos;ll see only{" "}
                <code className="bg-white/[0.06] px-1 rounded text-xs">DescribeInstances</code>,{" "}
                <code className="bg-white/[0.06] px-1 rounded text-xs">ListBuckets</code>,{" "}
                <code className="bg-white/[0.06] px-1 rounded text-xs">GetCallerIdentity</code>, and{" "}
                <code className="bg-white/[0.06] px-1 rounded text-xs">DescribeRegions</code>.
              </li>
              <li><strong>IAM policy:</strong> Review the inline policy on the role you created. It contains exactly the 3 permissions listed above.</li>
              <li><strong>CloudFormation template:</strong> The Launch Stack template is open — read it before deploying. It creates one IAM role, nothing else.</li>
            </ul>
          </section>

          {/* Questions */}
          <section className="rounded-xl bg-violet-500/[0.06] border border-violet-500/20 p-6">
            <h2 className="text-lg font-bold text-violet-300 mb-2">Questions?</h2>
            <p className="text-sm text-violet-400 mb-4">
              If you&apos;re running a vendor security review, we&apos;re happy to answer a security questionnaire or get on a call.
            </p>
            <Link
              href="/contact?subject=Security%20Review"
              className="btn-huly inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 transition-colors shadow-sm"
            >
              Contact security team
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          </section>

          {/* Footer */}
          <div className="border-t border-white/[0.06] pt-6 mt-10">
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-zinc-500">
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
              <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
