import "@/components/cockpit/cockpit.css";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { currentContext } from "@/lib/auth/currentContext";
import { CockpitShell } from "@/components/cockpit/CockpitShell";
import { prisma } from "@/lib/db";
import { deriveWorkspaceIdFromEmail } from "@/lib/auth/workspaceId";
export const dynamic = "force-dynamic";
export default async function ControlLayout({children}: {children: React.ReactNode}) {
  const context = await currentContext();
  if (!context.isAuthenticated || !context.email) {
    const path = (await headers()).get("x-axiom-cockpit-path");
    const target = path && (path === "/control" || path.startsWith("/control/") || path.startsWith("/control?")) ? path : "/control";
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(target)}`);
  }
  let workspaceOptions: { id: string; label: string; role: string }[] = [];
  if (context.sessionUserId) {
    try {
      const memberships = await prisma.orgMembership.findMany({ where: { userId: String(context.sessionUserId), acceptedAt: { not: null } }, select: { organizationId: true, role: true }, orderBy: { createdAt: "asc" } });
      const personal = String(deriveWorkspaceIdFromEmail(context.email));
      workspaceOptions = memberships.map(member => ({ id: member.organizationId, label: member.organizationId === personal ? "Personal workspace" : `Shared workspace · ${member.organizationId.slice(-8)}`, role: member.role }));
    } catch { /* Unverified choices are never offered. Membership checks still fail closed. */ }
  }
  return <CockpitShell workspaceOptions={workspaceOptions} currentWorkspace={String(context.organizationId ?? "")} email={context.email} workspace={context.workspaceLabel} roles={context.roles}>{children}</CockpitShell>;
}
