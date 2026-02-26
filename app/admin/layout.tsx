import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/admin/leads" className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
              Admin
            </Link>
            <Link
              href="/admin/leads"
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Leads
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <UserCircleIcon className="h-5 w-5" />
              {session.user.email}
            </span>
            <SignOutButton />
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-indigo-600"
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
