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
    <div className="min-h-screen bg-white/[0.02]">
      <header className="border-b border-white/[0.06] bg-white/[0.02]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/admin/leads" className="flex items-center gap-2 font-bold text-white">
              Admin
            </Link>
            <Link
              href="/admin/leads"
              className="text-sm text-violet-400 hover:underline"
            >
              Leads
            </Link>
            <Link
              href="/admin/enterprise-dashboard"
              className="text-sm text-violet-400 hover:underline"
            >
              Enterprise Dashboard
            </Link>
            <Link
              href="/admin/plan-debug"
              className="text-sm text-violet-400 hover:underline"
            >
              Plan Debug
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-400 flex items-center gap-2">
              <UserCircleIcon className="h-5 w-5" />
              {session.user.email}
            </span>
            <SignOutButton />
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-indigo-600"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Dashboard
            </Link>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  );
}
