import {prisma} from '@/lib/db';
import {readCurrentJiraTicketAdmin} from '@/lib/integrations/jira/jiraTicketWriteRuntime';
import {createJiraRefreshHttp} from '@/lib/integrations/jira/jiraRefreshHttp';
import {refreshStoredJiraConnection,type JiraRefreshRepository} from '@/lib/integrations/jira/jiraRefreshPersistence';
import type {JiraAuthorizationActor} from '@/lib/integrations/jira/jiraAuthorization';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const POST=createJiraRefreshHttp({
 enabled:()=>process.env.AXIOM_JIRA_TICKET_WRITE_CONSENT_ENABLED==='true',
 readCurrentActor:readCurrentJiraTicketAdmin,
 refresh:(actor,input,signal)=>refreshStoredJiraConnection(prisma as unknown as JiraRefreshRepository,{
  actor:actor as JiraAuthorizationActor,readCurrentActor:readCurrentJiraTicketAdmin,
  ...(input as {connectionId:string;revision:string}),
  clientId:process.env.JIRA_CLIENT_ID?.trim()??'',clientSecret:process.env.JIRA_CLIENT_SECRET?.trim()??'',transport:fetch,signal,
 }),
});
