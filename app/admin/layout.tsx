import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin/auth";
import Link from "next/link";
import { ArrowLeftIcon, UserCircleIcon } from "@heroicons/react/24/outline";
import { SignOutButton } from "@/app/dashboard/SignOutButton";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/auth/signin?callbackUrl=/admin/leads");
  }
  if (!isAdminEmail(session.user.email)) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-[#09090b] relative overflow-hidden">
      {/* Background pattern */}
      <div className="bg-grid-mesh absolute inset-0 pointer-events-none" />

      <header className="relative z-10 border-b border-white/[0.06] bg-white/[0.02] backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/admin/leads" className="flex items-center gap-2 font-bold text-white tracking-[-0.04em]">
              Admin
            </Link>
            <nav className="flex items-center gap-4">
              <Link
                href="/admin/leads"
                className="text-sm text-zinc-400 hover:text-violet-400 transition-colors"
              >
                Leads
              </Link>
              <Link
                href="/admin/marketing"
                className="text-sm text-zinc-400 hover:text-violet-400 transition-colors"
              >
                Marketing
              </Link>
              <Link
                href="/admin/enterprise-dashboard"
                className="text-sm text-zinc-400 hover:text-violet-400 transition-colors"
              >
                Tenants
              </Link>
              <Link
                href="/admin/flags"
                className="text-sm text-zinc-400 hover:text-violet-400 transition-colors"
              >
                Feature flags
              </Link>
              <Link
                href="/admin/self-diagnostic"
                className="text-sm text-zinc-400 hover:text-violet-400 transition-colors"
              >
                Diagnostics
              </Link>
              <Link
                href="/admin/cron-health"
                className="text-sm text-zinc-400 hover:text-violet-400 transition-colors"
              >
                Cron health
              </Link>
              <Link
                href="/admin/plan-debug"
                className="text-sm text-zinc-400 hover:text-violet-400 transition-colors"
              >
                Plan Debug
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="huly-badge flex items-center gap-2">
              <UserCircleIcon className="h-4 w-4" />
              {session.user.email}
            </span>
            <SignOutButton />
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-violet-400 transition-colors"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Dashboard
            </Link>
          </div>
        </div>
      </header>
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  );
}
