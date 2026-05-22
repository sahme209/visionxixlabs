/**
 * /dashboard/workforce/approvals — engineer-sourced approval queue.
 *
 * Reads recent AgentEngineerActionAttempt rows that requested approval
 * and joins them with the live ApprovalRequest from the approval
 * engine in-memory store. Operators see exactly what AGI staged,
 * which engineer staged it, the audit correlation id, and the
 * effective rule applied.
 *
 * Client-facing — internal_admin engineers are filtered out via the
 * registry productLayer check.
 */

import type { Metadata } from "next";
import Link from "next/link";
import {
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  CpuChipIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  AGENT_WORKFORCE_REGISTRY,
  type AgentEngineer,
} from "@/lib/workforce/agentWorkforceRegistry";
import { ApprovalDecisionButtons } from "@/components/workforce/ApprovalDecisionButtons";

export const metadata: Metadata = {
  title: "Engineer approvals · Axiom",
  description: "Risky engineer actions staged by AGI awaiting human approval.",
};

export const dynamic = "force-dynamic";

const ENGINEER_LOOKUP: Map<string, AgentEngineer> = new Map(
  AGENT_WORKFORCE_REGISTRY.filter((e) => e.productLayer === "client").map((e) => [e.id, e] as const),
);

export default async function EngineerApprovalsPage() {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return <div className="p-8 text-sm text-zinc-300">Sign in required.</div>;
  }

  // Read the durable Prisma snapshot + per-approver vote rows. Survives
  // deploys; no dependency on the engine's in-memory state.
  const snapshots = await prisma.engineerApprovalSnapshot.findMany({
    where: { organizationId: String(ctx.organizationId) },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      decisions: {
        select: { approverUserId: true, decision: true },
      },
    },
  }).catch(() => [] as Array<never>);

  const viewerUserId = ctx.userId ? String(ctx.userId) : (ctx.email ?? "unknown");

  const rows = snapshots.map((s) => {
    const engineer = ENGINEER_LOOKUP.get(s.engineerId);
    if (!engineer) return null;
    const approvedBy = Array.from(
      new Set(
        s.decisions
          .filter((d) => d.decision === "approved")
          .map((d) => d.approverUserId),
      ),
    );
    const rejectedCount = s.decisions.filter((d) => d.decision === "rejected").length;
    const myVote = s.decisions.find((d) => d.approverUserId === viewerUserId)?.decision ?? null;
    return {
      snapshot: s,
      engineer,
      approvedCount: approvedBy.length,
      rejectedCount,
      myVote: myVote as "approved" | "rejected" | null,
    };
  }).filter((r): r is NonNullable<typeof r> => r !== null);

  const pendingCount  = rows.filter((r) => r.snapshot.status === "pending").length;
  const approvedCount = rows.filter((r) => r.snapshot.status === "approved").length;
  const rejectedCount = rows.filter((r) => r.snapshot.status === "rejected").length;

  return (
    <div className="relative">
      <div className="mb-6">
        <Link href="/dashboard/workforce" className="text-[11px] text-violet-300 hover:text-violet-200 inline-flex items-center gap-1">
          <ArrowRightIcon className="h-3 w-3 rotate-180" />
          Back to Workforce
        </Link>
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <ShieldCheckIcon className="h-4 w-4 text-amber-400" />
          <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-widest">Engineer-sourced approvals</p>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[-0.04em] mb-2">
          What AGI staged · <span className="text-gradient">waiting for you.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-3xl leading-relaxed">
          Every engineer-staged action that needed approval. Source engineer, effective rule, correlation id, and the approval status all in one view.
        </p>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
        <Stat label="Pending" value={pendingCount} icon={ClockIcon} tone="text-amber-300" />
        <Stat label="Approved · last 50" value={approvedCount} icon={CheckCircleIcon} tone="text-emerald-300" />
        <Stat label="Rejected · last 50" value={rejectedCount} icon={ExclamationTriangleIcon} tone="text-rose-300" />
      </section>

      {rows.length === 0 ? (
        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
          <CpuChipIcon className="h-6 w-6 text-zinc-500 mx-auto mb-3" />
          <p className="text-[13px] font-semibold text-white">No engineer-sourced approvals yet.</p>
          <p className="text-[11.5px] text-zinc-500 mt-1 max-w-md mx-auto leading-snug">
            When AGI stages an action that needs approval, the request lands here with the engineer, audit correlation id, and effective policy in plain view.
          </p>
        </section>
      ) : (
        <section className="space-y-2.5">
          {rows.map(({ snapshot, engineer, approvedCount, rejectedCount, myVote }) => (
            <ApprovalRow
              key={snapshot.id}
              approvalId={snapshot.approvalRequestId}
              action={snapshot.action}
              engineerId={engineer.id}
              engineerName={engineer.displayName}
              effectiveRule={snapshot.effectiveRule}
              requiredApprovers={snapshot.requiredApprovers}
              approvedCount={approvedCount}
              rejectedCount={rejectedCount}
              myVote={myVote}
              correlationId={snapshot.correlationId}
              approvalStatus={snapshot.status}
              riskLevel={snapshot.riskLevel}
              connector={null}
              createdAt={snapshot.createdAt}
              decidedAt={snapshot.decidedAt}
              decidedByUserId={snapshot.decidedByUserId}
              decisionReason={snapshot.decisionReason}
            />
          ))}
        </section>
      )}

      <section className="mt-8 rounded-2xl border border-amber-500/15 bg-amber-500/[0.04] p-5">
        <p className="text-[10px] font-semibold text-amber-300 uppercase tracking-widest mb-2">// approval rules</p>
        <ul className="text-[12px] text-zinc-300 leading-relaxed list-disc list-inside marker:text-amber-400/70 space-y-1">
          <li>The runtime gate is the only path that produces these rows — engineers cannot bypass it.</li>
          <li>Required-approver count is fixed at staging time. Tightening the engineer policy later doesn't loosen already-staged approvals.</li>
          <li>Decided approvals (approved or rejected) write to the audit fabric with the deciding user + reason.</li>
          <li>The in-memory approval store is volatile across deploys — Prisma persistence ships in a follow-up phase.</li>
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value, icon: Icon, tone, sub }: { label: string; value: number; icon: typeof ShieldCheckIcon; tone: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <Icon className={`h-4 w-4 ${tone} mb-2`} />
      <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
      <p className="text-[11px] text-zinc-400 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-zinc-500 mt-1 leading-snug">{sub}</p>}
    </div>
  );
}

function ApprovalRow(props: {
  approvalId: string | null;
  action: string;
  engineerId: string;
  engineerName: string;
  effectiveRule: string;
  requiredApprovers: number;
  approvedCount: number;
  rejectedCount: number;
  myVote: "approved" | "rejected" | null;
  correlationId: string;
  approvalStatus: string;
  riskLevel: string;
  connector: string | null;
  createdAt: Date;
  decidedAt?: Date | null;
  decidedByUserId?: string | null;
  decisionReason?: string | null;
}) {
  const statusTone =
    props.approvalStatus === "pending"   ? "text-amber-300 bg-amber-500/10 border-amber-500/30" :
    props.approvalStatus === "approved"  ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/30" :
    props.approvalStatus === "rejected"  ? "text-rose-300 bg-rose-500/10 border-rose-500/30"     :
                                           "text-zinc-400 bg-white/[0.04] border-white/[0.08]";

  return (
    <article className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <header className="flex items-center justify-between gap-3 flex-wrap mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <CpuChipIcon className="h-4 w-4 text-violet-300 shrink-0" />
          <Link href={`/dashboard/workforce/${props.engineerId}`} className="text-[12px] font-semibold text-white hover:text-violet-200 truncate">
            {props.engineerName}
          </Link>
        </div>
        <span className={`text-[9px] font-mono uppercase tracking-wider border rounded-full px-1.5 py-0.5 ${statusTone}`}>
          {props.approvalStatus}
        </span>
      </header>

      <p className="text-[11.5px] font-mono text-zinc-200 mb-1 truncate">{props.action}</p>

      <div className="flex items-center gap-3 flex-wrap text-[10px] font-mono text-zinc-500 mb-2">
        <span>risk · {props.riskLevel}</span>
        <span>rule · {props.effectiveRule}</span>
        <span className={props.approvedCount >= props.requiredApprovers && props.requiredApprovers > 0 ? "text-emerald-300" : ""}>
          {props.approvedCount}/{Math.max(props.requiredApprovers, 1)} approver{props.requiredApprovers === 1 ? "" : "s"}
        </span>
        {props.rejectedCount > 0 && <span className="text-rose-300">{props.rejectedCount} reject{props.rejectedCount === 1 ? "" : "s"}</span>}
        {props.myVote && (
          <span className={`uppercase tracking-wider ${props.myVote === "approved" ? "text-emerald-300" : "text-rose-300"}`}>
            your vote · {props.myVote}
          </span>
        )}
        {props.connector && <span>connector · {props.connector}</span>}
        <span className="ml-auto">{props.createdAt.toISOString()}</span>
      </div>
      <p className="text-[10px] font-mono text-zinc-600 mb-2">correlation · {props.correlationId}</p>

      {props.decidedAt && (
        <p className="text-[10px] font-mono text-zinc-500 mb-2">
          decided · {props.decidedAt.toISOString()}{props.decidedByUserId ? ` · by ${props.decidedByUserId}` : ""}
          {props.decisionReason ? ` · "${props.decisionReason}"` : ""}
        </p>
      )}

      {/* Decision actions — only shown when the snapshot is still pending. */}
      <div className="pt-2 border-t border-white/[0.04] flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          {props.approvalId ? (
            <Link
              href={`/dashboard/workforce/approvals/${props.approvalId}`}
              className="text-[10px] font-mono text-zinc-400 hover:text-violet-200 truncate"
            >
              approval · {props.approvalId} →
            </Link>
          ) : (
            <span className="text-[10px] font-mono text-zinc-500">approval not reachable</span>
          )}
        </div>
        {props.approvalId ? (
          <ApprovalDecisionButtons
            approvalId={props.approvalId}
            status={props.approvalStatus}
            myVote={props.myVote}
            approvedCount={props.approvedCount}
            requiredApprovers={props.requiredApprovers}
          />
        ) : (
          <span className="text-[10px] font-mono text-zinc-500">no buttons · snapshot missing approval id</span>
        )}
      </div>
    </article>
  );
}
