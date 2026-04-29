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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <Navigation />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8 md:p-12">
          {/* Header */}
          <div className="text-center mb-12">
            <ShieldCheckIcon className="h-16 w-16 text-emerald-600 dark:text-emerald-400 mx-auto mb-4" />
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-slate-900 dark:text-slate-100">
              Security
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              How we connect to your cloud, what we can see, and what we do with
              your data. No marketing — just the technical details.
            </p>
          </div>

          {/* TL;DR */}
          <section className="mb-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 p-6">
            <h2 className="text-lg font-bold text-emerald-800 dark:text-emerald-300 mb-3">
              TL;DR
            </h2>
            <ul className="space-y-2 text-sm text-emerald-800 dark:text-emerald-300">
              <li>
                <strong>Read-only access.</strong> We cannot modify, delete, or
                write anything in your AWS account.
              </li>
              <li>
                <strong>3 API permissions.</strong> We call{" "}
                <code className="bg-emerald-100 dark:bg-emerald-900/40 px-1 rounded text-xs">
                  ec2:Describe*
                </code>
                ,{" "}
                <code className="bg-emerald-100 dark:bg-emerald-900/40 px-1 rounded text-xs">
                  s3:ListAllMyBuckets
                </code>
                , and{" "}
                <code className="bg-emerald-100 dark:bg-emerald-900/40 px-1 rounded text-xs">
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
              <KeyIcon className="h-6 w-6 text-slate-700 dark:text-slate-300" />
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                How AWS connection works
              </h2>
            </div>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
              We use the industry-standard{" "}
              <strong>cross-account AssumeRole</strong> pattern. This is the
              same mechanism used by AWS organizations, Datadog, Prisma Cloud,
              and every major cloud tool.
            </p>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-sm font-bold text-indigo-700 dark:text-indigo-300">
                  1
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    You create an IAM role in your account
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    The role trusts our broker account (
                    <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded text-xs">
                      {AWS_BROKER_ACCOUNT_ID}
                    </code>
                    ) with a unique External ID tied to your session. This
                    prevents{" "}
                    <a
                      href="https://docs.aws.amazon.com/IAM/latest/UserGuide/confused-deputy.html"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 dark:text-indigo-400 underline"
                    >
                      confused deputy attacks
                    </a>
                    .
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-sm font-bold text-indigo-700 dark:text-indigo-300">
                  2
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    We assume the role with a 15-minute session
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Our broker calls{" "}
                    <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded text-xs">
                      sts:AssumeRole
                    </code>{" "}
                    with DurationSeconds=900 (15 minutes). The temporary
                    credentials expire automatically.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-sm font-bold text-indigo-700 dark:text-indigo-300">
                  3
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    We run read-only API calls
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Count EC2 instances, list S3 bucket names, verify account
                    identity. We cannot read bucket contents, modify resources,
                    or access any other service.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-sm font-bold text-indigo-700 dark:text-indigo-300">
                  4
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    Session expires, credentials are discarded
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    After the scan completes, the temporary STS token expires.
                    We do not cache or persist AWS credentials.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Exact permissions */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <EyeSlashIcon className="h-6 w-6 text-slate-700 dark:text-slate-300" />
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                Exact permissions we request
              </h2>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800">
                    <th className="text-left px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                      Permission
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                      What it does
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                      What it cannot do
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-slate-200 dark:border-slate-700">
                    <td className="px-4 py-3 font-mono text-xs text-indigo-700 dark:text-indigo-400">
                      ec2:Describe*
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      Count instances, list regions, read instance metadata
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      Cannot start, stop, terminate, or modify any instance
                    </td>
                  </tr>
                  <tr className="border-t border-slate-200 dark:border-slate-700">
                    <td className="px-4 py-3 font-mono text-xs text-indigo-700 dark:text-indigo-400">
                      s3:ListAllMyBuckets
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      Count bucket names
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      Cannot read, download, delete, or list objects inside any
                      bucket
                    </td>
                  </tr>
                  <tr className="border-t border-slate-200 dark:border-slate-700">
                    <td className="px-4 py-3 font-mono text-xs text-indigo-700 dark:text-indigo-400">
                      sts:GetCallerIdentity
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      Verify we are in your account (returns account ID and ARN)
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      Cannot assume other roles or escalate privileges
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              You can verify every API call we make by checking your{" "}
              <strong>CloudTrail</strong> logs.
            </p>
          </section>

          {/* What we store */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <ServerStackIcon className="h-6 w-6 text-slate-700 dark:text-slate-300" />
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                What we store
              </h2>
            </div>
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                <p className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
                  Scan results
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Instance count, bucket count, region list, risk flags, and
                  generated insights. Stored as JSON attached to your session
                  record. No raw AWS API responses are persisted.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                <p className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
                  Scan history
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Up to 5 previous scan snapshots for trend comparison. Older
                  snapshots are automatically dropped.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                <p className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
                  IAM Role ARN
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  The Role ARN and External ID you provided, encrypted at rest
                  using AES-256-GCM. Used to re-assume the role for subsequent
                  scans. Deleted when you disconnect.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 p-4">
              <p className="font-semibold text-red-800 dark:text-red-300 mb-1">
                What we never store
              </p>
              <ul className="text-sm text-red-700 dark:text-red-400 space-y-1">
                <li>
                  - AWS access keys, secret keys, or session tokens
                </li>
                <li>- Contents of S3 buckets or EBS volumes</li>
                <li>- Application logs, environment variables, or secrets</li>
                <li>- IAM user credentials or root account information</li>
              </ul>
            </div>
          </section>

          {/* Data retention */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <ClockIcon className="h-6 w-6 text-slate-700 dark:text-slate-300" />
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                Data retention
              </h2>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800">
                    <th className="text-left px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                      Data type
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                      Retention
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-slate-200 dark:border-slate-700">
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      Scan results &amp; insights
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      While your account is active. Deleted on request.
                    </td>
                  </tr>
                  <tr className="border-t border-slate-200 dark:border-slate-700">
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      Scan history (comparisons)
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      Last 5 snapshots. Oldest auto-deleted.
                    </td>
                  </tr>
                  <tr className="border-t border-slate-200 dark:border-slate-700">
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      Encrypted Role ARN
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      Until you disconnect. Immediately deleted on disconnect.
                    </td>
                  </tr>
                  <tr className="border-t border-slate-200 dark:border-slate-700">
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      STS session tokens
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      Never stored. Used in-memory only. Expire after 15 minutes
                      automatically.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* How to revoke */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <TrashIcon className="h-6 w-6 text-slate-700 dark:text-slate-300" />
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                How to revoke access
              </h2>
            </div>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
              Delete the IAM role from your AWS account. That&apos;s it. We can
              no longer assume the role and all future scan attempts will fail.
            </p>
            <div className="rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 p-4">
              <p className="text-sm font-mono text-slate-700 dark:text-slate-300 mb-2">
                AWS Console &rarr; IAM &rarr; Roles &rarr; Find the
                CloudOperator role &rarr; Delete
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Or via CLI:{" "}
                <code className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-xs">
                  aws iam delete-role --role-name CloudOperatorReadOnly
                </code>
              </p>
            </div>
          </section>

          {/* Compliance */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <LockClosedIcon className="h-6 w-6 text-slate-700 dark:text-slate-300" />
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                Compliance &amp; certifications
              </h2>
            </div>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
              We are transparent about where we are in our compliance journey:
            </p>
            <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
              <li>
                <strong>Encryption:</strong> TLS 1.2+ in transit. AES-256-GCM
                at rest for credential storage.
              </li>
              <li>
                <strong>Infrastructure:</strong> Hosted on Vercel (SOC2
                certified) with PostgreSQL on managed infrastructure.
              </li>
              <li>
                <strong>DPA:</strong> Available for enterprise clients on
                request.
              </li>
              <li>
                <strong>SOC2 / ISO 27001:</strong> Not yet certified. We follow
                SOC2-aligned practices (least privilege, audit logging,
                encryption at rest) and will pursue formal certification as we
                scale.
              </li>
            </ul>
          </section>

          {/* Verify us */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              Verify our claims
            </h2>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
              You don&apos;t have to trust our word. Here&apos;s how to verify
              independently:
            </p>
            <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
              <li>
                <strong>CloudTrail:</strong> Check your CloudTrail Event History
                for all API calls made by the assumed role. You&apos;ll see only{" "}
                <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded text-xs">
                  DescribeInstances
                </code>
                ,{" "}
                <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded text-xs">
                  ListBuckets
                </code>
                ,{" "}
                <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded text-xs">
                  GetCallerIdentity
                </code>
                , and{" "}
                <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded text-xs">
                  DescribeRegions
                </code>
                .
              </li>
              <li>
                <strong>IAM policy:</strong> Review the inline policy on the
                role you created. It contains exactly the 3 permissions listed
                above.
              </li>
              <li>
                <strong>CloudFormation template:</strong> The Launch Stack
                template is open — read it before deploying. It creates one IAM
                role, nothing else.
              </li>
            </ul>
          </section>

          {/* Questions */}
          <section className="rounded-xl bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/40 p-6">
            <h2 className="text-lg font-bold text-indigo-800 dark:text-indigo-300 mb-2">
              Questions?
            </h2>
            <p className="text-sm text-indigo-700 dark:text-indigo-400 mb-4">
              If you&apos;re running a vendor security review, we&apos;re happy
              to answer a security questionnaire or get on a call.
            </p>
            <Link
              href="/contact?subject=Security%20Review"
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
            >
              Contact security team
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          </section>

          {/* Footer */}
          <div className="border-t border-slate-200 dark:border-slate-700 pt-6 mt-10">
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-slate-500 dark:text-slate-400">
              <Link href="/privacy" className="hover:text-slate-700 dark:hover:text-slate-300 underline">
                Privacy Policy
              </Link>
              <Link href="/terms" className="hover:text-slate-700 dark:hover:text-slate-300 underline">
                Terms of Service
              </Link>
              <Link href="/contact" className="hover:text-slate-700 dark:hover:text-slate-300 underline">
                Contact
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
