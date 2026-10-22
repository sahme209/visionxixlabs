import "@/components/cockpit/cockpit.css";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { currentContext } from "@/lib/auth/currentContext";
import { CockpitShell } from "@/components/cockpit/CockpitShell";
/** Compatibility frame for retained signed-in help routes. */
export async function AuthCompanionShell({children}: {children: ReactNode}) {
 const context = await currentContext();
 if (!context.isAuthenticated || !context.email) redirect("/auth/signin?callbackUrl=/account/help");
 return <CockpitShell email={context.email} workspace={context.workspaceLabel} roles={context.roles}>{children}</CockpitShell>;
}
