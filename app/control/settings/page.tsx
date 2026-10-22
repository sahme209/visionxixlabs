import { redirect } from "next/navigation";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { AccountSettingsForm } from "@/components/auth/AccountSettingsForm";
import { SectionTabs } from "@/components/cockpit/SectionTabs";
import { DesktopSessionsPanel } from "@/components/auth/DesktopSessionsPanel";
export const dynamic = "force-dynamic";
export default async function SettingsPage({searchParams}: {searchParams?:Promise<{section?:string | string[]}>}) {
  const requestedSection = (await searchParams)?.section;
  const section = typeof requestedSection === "string" && ["profile","security","sessions"].includes(requestedSection) ? requestedSection : "profile";
  const context = await currentContext();
  if (!context.isAuthenticated || !context.userId || !context.email) redirect(`/auth/signin?callbackUrl=${encodeURIComponent(section === "profile" ? "/control/settings" : `/control/settings?section=${section}`)}`);
  const user = await prisma.user.findUnique({where:{id:context.userId}, select:{name:true}});
  return <div className="max-w-4xl"><h1>Settings</h1><p className="mt-3 text-sm leading-6 text-zinc-400">Manage your profile, account security, and paired devices.</p><SectionTabs key={section} label="Account settings" initialId={section} keepMounted items={[
    {id:"profile",label:"Profile",content:<AccountSettingsForm initialDisplayName={user?.name ?? context.displayName ?? ""} email={context.email}/>},
    {id:"security",label:"Security",content:<section className="rounded-xl border border-white/[0.08] bg-[#171717] p-6"><h2 className="text-base font-medium">Sign-in & access</h2><dl className="mt-5 divide-y divide-white/[0.08] text-sm"><div className="flex flex-wrap justify-between gap-3 py-4"><dt className="text-zinc-400">Sign-in email</dt><dd className="break-all">{context.email}</dd></div><div className="flex flex-wrap justify-between gap-3 py-4"><dt className="text-zinc-400">Browser session</dt><dd>Signed in</dd></div></dl><p className="mt-4 max-w-2xl text-xs leading-6 text-zinc-400">Your sign-in email and workspace permissions cannot be changed through the profile form. Signing out ends this browser session; paired desktop sessions remain independent. Review and revoke them in Sessions.</p></section>},
    {id:"sessions",label:"Sessions",content:<DesktopSessionsPanel/>},
  ]}/></div>;
}
