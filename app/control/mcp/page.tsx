import {redirect} from 'next/navigation';
import {currentContext} from '@/lib/auth/currentContext';
import {prisma} from '@/lib/db';
import {MicrosoftLearnTools} from '@/components/cockpit/MicrosoftLearnTools';
import type {AgentSkillRepo} from '@/lib/axiom/agentRuntime/skillCatalog';
export const dynamic='force-dynamic';
export default async function McpToolsPage(){
 const context=await currentContext();
 if(!context.isAuthenticated||!context.organizationId)redirect('/auth/signin?callbackUrl=%2Fcontrol%2Fmcp');
 if(!context.roles.length)return <p role="alert">A current workspace membership is required to use MCP tools.</p>;
 let enabled=false,storageAvailable=true;
 try{const rows=await(prisma as unknown as AgentSkillRepo).agentSkillInstallation.findMany({where:{organizationId:String(context.organizationId),status:'enabled'}});enabled=rows.some(row=>row.skillId==='microsoft-learn-docs'&&row.status==='enabled');}catch{storageAvailable=false;}
 return <div><h1>MCP tools</h1><p className="mt-1 text-[13px] leading-5 text-zinc-400">Use reviewed external tools with explicit workspace installation and permission boundaries.</p><MicrosoftLearnTools enabled={enabled} storageAvailable={storageAvailable}/></div>;
}
