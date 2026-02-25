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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <CpuChipIcon className="h-8 w-8 text-indigo-600" />
            <span className="font-bold text-slate-900 dark:text-slate-100">Vision XIX AI</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600 dark:text-slate-400">{session.user.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  );
}
