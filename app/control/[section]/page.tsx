import Link from "next/link";
import { notFound } from "next/navigation";

const sections = {
  governance: ["Governance", "Roles, permissions, approval rules, repository policy, and production restrictions will move here after their real APIs pass authorization parity tests."],
  "ai-agents": ["AI & Agents", "Approved models, agent identities, autonomy, tool permissions, and organization budgets will be administered here."],
  integrations: ["Integrations", "Connection consent, scopes, validation health, and revocation will be managed here. Provider credentials remain server-side."],
  "usage-billing": ["Usage & Billing", "Plans, seats, deployment allowances, prepaid AI credits, and transactions remain authoritative in the billing backend."],
  "audit-security": ["Audit & Security", "Approval history, agent activity, deployment evidence, sessions, and security events will be searchable here."],
} as const;

export default async function ControlSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const content = sections[section as keyof typeof sections];
  if (!content) notFound();
  return (
    <div className="max-w-3xl">
      <p className="text-[11px] uppercase tracking-[0.2em] text-[#ff783d]">Governance control plane</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.045em]">{content[0]}</h1>
      <p className="mt-4 text-sm leading-6 text-zinc-400">{content[1]}</p>
      <div className="mt-10 border-y border-white/[0.08] py-6">
        <p className="text-sm font-medium">Migration in progress</p>
        <p className="mt-2 text-sm leading-6 text-zinc-500">This section intentionally shows no simulated organization state. Existing controls remain available through their current verified surface until migration and security tests pass.</p>
      </div>
      <Link href="/control" className="mt-6 inline-flex text-sm text-[#ff783d] hover:text-[#ff9a6d]">← Return to overview</Link>
    </div>
  );
}
