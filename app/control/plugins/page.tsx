import { redirect } from "next/navigation";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import "@/lib/plugins/aws/index";
import "@/lib/plugins/azure/index";
import "@/lib/plugins/github/index";
import { listExecutionPlugins } from "@/lib/plugins/executionRegistry";
import { AGENT_SKILL_CATALOG, type AgentSkillRepo } from "@/lib/axiom/agentRuntime/skillCatalog";
import { Catalog, type CatalogEntry } from "@/components/cockpit/Catalog";
export const dynamic = "force-dynamic";
export default async function PluginsPage() {
 const context=await currentContext();
 if(!context.isAuthenticated || !context.organizationId) redirect("/auth/signin?callbackUrl=/control/plugins");
 if(!context.roles.length) return <p role="alert">A current workspace membership is required to view installed skills.</p>;
 let unavailable=false;
 let rows: Array<{skillId:string;status:string}>=[];
 try {rows=await (prisma as unknown as AgentSkillRepo).agentSkillInstallation.findMany({where:{organizationId:String(context.organizationId)}});}catch{unavailable=true;}
 const entries: CatalogEntry[]=[...listExecutionPlugins().map(plugin=>({id:plugin.id,name:plugin.name,description:plugin.description,kind:"Plugins" as const,status:plugin.modifiesInfrastructure ? "Approval and provider setup required":"Provider setup and policy required",permissions:[...plugin.scopesRequired]})),...AGENT_SKILL_CATALOG.map(skill=>({id:skill.id,name:skill.name,description:skill.description,kind:"Skills" as const,status:unavailable ? "Unknown":rows.find(row=>row.skillId===skill.id)?.status ?? "not_installed",permissions:[...skill.toolNames]}))];
 return <div><h1>Plugins & skills</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">Explore Axiom’s registered automation and curated workflows. Installed skills guide the Agent; they never grant tool permissions.</p><Catalog entries={entries} unavailable={unavailable} canManage={context.roles.some(role=>role==="owner"||role==="admin")}/></div>;
}
