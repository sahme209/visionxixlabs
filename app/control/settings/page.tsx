import { redirect } from "next/navigation";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { AccountSettingsForm } from "@/components/auth/AccountSettingsForm";
import { DesktopSessionsPanel } from "@/components/auth/DesktopSessionsPanel";
export const dynamic = "force-dynamic";
export default async function SettingsPage() {
  const context = await currentContext();
  if (!context.isAuthenticated || !context.userId || !context.email) redirect("/auth/signin?callbackUrl=/control/settings");
  const user = await prisma.user.findUnique({where:{id:context.userId}, select:{name:true}});
  return <div className="max-w-3xl"><h1>Settings</h1><p className="mt-3 text-sm leading-6 text-zinc-400">Manage your profile and review devices with access to Axiom.</p><div className="mt-8"><AccountSettingsForm initialDisplayName={user?.name ?? context.displayName ?? ""} email={context.email}/></div><div className="mt-5"><DesktopSessionsPanel /></div><p className="mt-4 text-xs leading-5 text-zinc-400">Signing out ends this browser session. Revoke a paired device above to end its independent access.</p></div>;
}
