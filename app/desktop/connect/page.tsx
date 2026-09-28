import Link from "next/link";
import { redirect } from "next/navigation";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { PairDesktopClient } from "./PairDesktopClient";

export const dynamic = "force-dynamic";

export default async function DesktopConnectPage({ searchParams }: { searchParams: Promise<{ challenge?: string }> }) {
  const challenge = (await searchParams).challenge ?? "";
  const pairing = challenge
    ? await prisma.desktopPairingChallengeRecord.findUnique({ where: { id: challenge } })
    : null;
  // This is a request-time server component; expiry must be checked against the
  // current request rather than captured at build time.
  // eslint-disable-next-line react-hooks/purity
  if (!pairing || pairing.expiresAt.getTime() <= Date.now() || pairing.consumedAt) {
    return <Message title="Pairing link invalid" detail="Return to Axiom Agent and start sign-in again." />;
  }

  const context = await currentContext();
  if (!context.isAuthenticated) {
    const callbackUrl = `/desktop/connect?challenge=${encodeURIComponent(challenge)}`;
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  return (
    <main className="min-h-screen bg-[#09090b] px-4 py-16 text-white">
      <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-[#101014] p-8 shadow-2xl">
        <Link href="/" className="text-xs uppercase tracking-widest text-violet-300">Vision XIX Labs</Link>
        <h1 className="mt-6 text-3xl font-bold">Connect Axiom Agent</h1>
        <p className="mb-7 mt-2 text-sm leading-6 text-zinc-400">
          Signed in as <span className="text-zinc-200">{context.email}</span>. Approve only if this is your desktop.
        </p>
        <dl className="mb-6 divide-y divide-white/[0.07] rounded-xl border border-white/[0.08] bg-black/20 px-4 text-sm">
          <Row label="Device" value={pairing.deviceLabel} />
          <Row label="Platform" value={pairing.platform} />
          <Row label="App version" value={pairing.desktopVersion ?? "Not reported"} />
          <Row label="Request expires" value={pairing.expiresAt.toLocaleString()} />
        </dl>
        <PairDesktopClient challenge={challenge} deviceLabel={pairing.deviceLabel} />
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-5 py-3"><dt className="text-zinc-500">{label}</dt><dd className="text-right text-zinc-200">{value}</dd></div>;
}

function Message({ title, detail }: { title: string; detail: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#09090b] px-4 text-white">
      <div className="max-w-md rounded-2xl border border-white/10 bg-[#101014] p-8 text-center">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-3 text-sm text-zinc-400">{detail}</p>
      </div>
    </main>
  );
}
