import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { PairDesktopClient } from "./PairDesktopClient";
import { readDesktopCommercialAccess } from "@/lib/desktop/desktopCommercialAccess";

export const dynamic = "force-dynamic";

export default async function DesktopConnectPage({ searchParams }: { searchParams: Promise<{ challenge?: string; intent?: string }> }) {
  const params = await searchParams;
  const challenge = params.challenge ?? "";
  const intent = params.intent === "sign_up" ? "sign_up" : "sign_in";
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
    const callbackUrl = `/desktop/connect?challenge=${encodeURIComponent(challenge)}&intent=${intent}`;
    redirect(intent === "sign_up"
      ? `/auth/signup?redirect=${encodeURIComponent(callbackUrl)}`
      : `/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }
  const access = await readDesktopCommercialAccess(context.organizationId!);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0d0e0c] px-5 py-20 text-white">
      <Link href="/" className="absolute left-6 top-6 flex items-center gap-2.5 text-sm font-semibold text-zinc-200">
        <Image src="/vision-xix-logo.png" alt="" width={27} height={27} className="rounded-md" />
        Vision XIX Labs
      </Link>
      <div className="w-full max-w-lg p-2 sm:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035]"><Image src="/vision-xix-logo.png" alt="" width={30} height={30} className="rounded-md" /></div>
        <h1 className="mt-7 text-3xl font-normal tracking-[-0.045em]">Authorize Axiom Agent</h1>
        <p className="mb-7 mt-2 text-sm leading-6 text-zinc-400">
          Signed in as <span className="text-zinc-200">{context.email}</span>. Approve only if this is your desktop.
        </p>
        <dl className="mb-6 divide-y divide-white/[0.07] rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 text-sm">
          <Row label="Device" value={pairing.deviceLabel} />
          <Row label="Platform" value={pairing.platform} />
          <Row label="App version" value={pairing.desktopVersion ?? "Not reported"} />
          <Row label="Request expires" value={pairing.expiresAt.toLocaleString()} />
        </dl>
        {!access.allowed && (
          <div className="mb-5 rounded-xl border border-amber-400/20 bg-amber-400/[0.07] p-5">
            <p className="text-sm font-semibold text-amber-100">{access.title}</p>
            <p className="mt-2 text-sm leading-6 text-zinc-300">{access.message}</p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Link href={access.accessRequestPath} className="rounded-full bg-white px-4 py-2 text-center text-sm font-semibold text-black">
                Request production access
              </Link>
              <Link href={access.pricingPath} className="rounded-full border border-white/15 px-4 py-2 text-center text-sm font-semibold text-white">
                Review access model
              </Link>
            </div>
          </div>
        )}
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
    <main className="flex min-h-screen items-center justify-center bg-[#0d0e0c] px-5 text-white">
      <div className="max-w-md p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035]"><Image src="/vision-xix-logo.png" alt="" width={30} height={30} className="rounded-md" /></div>
        <h1 className="mt-7 text-2xl font-normal">{title}</h1>
        <p className="mt-3 text-sm text-zinc-400">{detail}</p>
      </div>
    </main>
  );
}
