import Link from "next/link";
import { redirect } from "next/navigation";
import { currentContext } from "@/lib/auth/currentContext";
import { verifyPairingChallenge } from "@/lib/desktop/pairingChallenge";
import { PairDesktopClient } from "./PairDesktopClient";

export const dynamic = "force-dynamic";

export default async function DesktopConnectPage({ searchParams }: { searchParams: Promise<{ challenge?: string }> }) {
  const challenge = (await searchParams).challenge ?? "";
  let pairing;
  try {
    pairing = verifyPairingChallenge(challenge);
  } catch {
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
        <PairDesktopClient challenge={challenge} deviceLabel={pairing.deviceLabel} />
      </div>
    </main>
  );
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
