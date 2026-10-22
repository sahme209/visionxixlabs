import "@/components/cockpit/cockpit.css";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { currentContext } from "@/lib/auth/currentContext";
import { CockpitShell } from "@/components/cockpit/CockpitShell";
export const dynamic = "force-dynamic";
export default async function ControlLayout({children}: {children: React.ReactNode}) {
  const context = await currentContext();
  if (!context.isAuthenticated || !context.email) {
    const path = (await headers()).get("x-axiom-cockpit-path");
    const target = path && (path === "/control" || path.startsWith("/control/") || path.startsWith("/control?")) ? path : "/control";
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(target)}`);
  }
  return <CockpitShell email={context.email} workspace={context.workspaceLabel} roles={context.roles}>{children}</CockpitShell>;
}
