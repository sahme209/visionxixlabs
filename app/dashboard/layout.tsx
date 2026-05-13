import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { CpuChipIcon } from "@heroicons/react/24/outline";
import { SignOutButton } from "./SignOutButton";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/auth/signin?callbackUrl=/dashboard");
  }

  return (
    <div className="min-h-screen bg-[#09090b] relative overflow-hidden">
      {/* Background pattern */}
      <div className="bg-grid-mesh absolute inset-0 pointer-events-none" />

      <header className="relative z-10 glass-dark border-b border-white/[0.06] backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 nav-link-underline">
            <CpuChipIcon className="h-8 w-8 text-violet-500" />
            <span className="font-bold text-white tracking-[-0.04em]">Axiom</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-400">{session.user.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  );
}
