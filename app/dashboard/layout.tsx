import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { CpuChipIcon } from "@heroicons/react/24/outline";
import { DashboardSidebar } from "./DashboardSidebar";
import { ContextualHelpBubble } from "./ContextualHelpBubble";
import { TrialCountdownBanner } from "./TrialCountdownBanner";
import { FeedbackWidget } from "./FeedbackWidget";
import { DemoModeBanner } from "./DemoModeBanner";
import { PendingApprovalsBadge } from "./PendingApprovalsBadge";
import { ProfileMenu } from "./ProfileMenu";

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

      <header className="relative z-20 glass-dark border-b border-white/[0.06] backdrop-blur-sm">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <Link href="/dashboard/command-center" className="flex items-center gap-2 nav-link-underline">
            <CpuChipIcon className="h-7 w-7 text-violet-500" />
            <span className="font-bold text-white tracking-[-0.04em]">Axiom</span>
          </Link>
          <div className="flex items-center gap-3">
            <PendingApprovalsBadge />
            <ProfileMenu email={session.user.email ?? ""} />
          </div>
        </div>
      </header>

      <div className="relative z-10 max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 lg:flex lg:gap-8">
        <DashboardSidebar />
        <main className="flex-1 min-w-0 py-6 lg:py-8">
          <DemoModeBanner />
          <TrialCountdownBanner />
          {children}
        </main>
      </div>

      <ContextualHelpBubble />
      <FeedbackWidget />
    </div>
  );
}
