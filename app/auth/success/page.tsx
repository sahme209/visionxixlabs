import Link from "next/link";
import { redirect } from "next/navigation";
import { currentContext } from "@/lib/auth/currentContext";

export const dynamic = "force-dynamic";

export default async function AuthSuccessPage() {
  const context = await currentContext();
  if (!context.isAuthenticated) redirect("/auth/signin?callbackUrl=/auth/success");
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#09090b] px-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-emerald-500/20 bg-[#101014] p-8 text-center">
        <p className="text-xs uppercase tracking-[0.22em] text-emerald-300">Signed in</p>
        <h1 className="mt-3 text-3xl font-bold">Welcome back.</h1>
        <p className="mt-3 text-sm text-zinc-400">Authenticated as {context.email}. Browser sign-in verifies your identity; governed deployment work remains in Axiom Agent.</p>
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <Link href="/download" className="rounded-full bg-violet-600 px-4 py-2.5 text-sm font-semibold hover:bg-violet-500">Open Axiom Agent</Link>
          <Link href="/demo" className="rounded-full border border-white/10 px-4 py-2.5 text-sm font-semibold hover:bg-white/5">Open sandbox demo</Link>
        </div>
      </div>
    </main>
  );
}
