import 'server-only';
import {prisma} from '@/lib/db';
import {currentContext} from '@/lib/auth/currentContext';
import {createJiraTicketWriteConnection,type JiraTicketWriteRepository} from './jiraTicketWriteConnection';
import {createJiraTicketWriteAuthorization} from './jiraTicketWriteAuthorization';
import {createJiraTicketWriteHttp} from './jiraTicketWriteHttp';
import type {TenantConnectionRepo} from '../tenantConnectionRepo';
export async function readCurrentJiraTicketAdmin(){const context=await currentContext();if(!context.isAuthenticated||!context.organizationId||!context.userId)return null;const member=await prisma.orgMembership.findFirst({where:{organizationId:context.organizationId,userId:context.userId,acceptedAt:{not:null},role:{in:['owner','admin']}},select:{organizationId:true,userId:true}});return member?{...member,canManageConnections:true as const}:null}
const repo=prisma as unknown as JiraTicketWriteRepository & TenantConnectionRepo;
export const jiraTicketWriteConnection=createJiraTicketWriteConnection(repo,{readCurrentActor:readCurrentJiraTicketAdmin,readConfiguration:()=>({clientId:process.env.JIRA_CLIENT_ID?.trim()??'',clientSecret:process.env.JIRA_CLIENT_SECRET?.trim()??'',redirectUri:'https://visionxixlabs.com/api/integrations/jira/callback'})});
const authorization=createJiraTicketWriteAuthorization(repo,jiraTicketWriteConnection);
export const jiraTicketWriteHttp=createJiraTicketWriteHttp({enabled:()=>process.env.AXIOM_JIRA_TICKET_WRITE_CONSENT_ENABLED==='true',authorization,readRateKey:async()=>{const actor=await readCurrentJiraTicketAdmin();if(!actor)throw Error('unavailable');return actor.organizationId+':'+actor.userId}});

const reporterConnection=createJiraTicketWriteConnection(repo,{readCurrentActor:readCurrentJiraTicketAdmin,requireExistingWrite:true,readConfiguration:()=>({clientId:process.env.JIRA_CLIENT_ID?.trim()??'',clientSecret:process.env.JIRA_CLIENT_SECRET?.trim()??'',redirectUri:'https://visionxixlabs.com/api/integrations/jira/callback'})});
const reporterAuthorization=createJiraTicketWriteAuthorization(repo,{...reporterConnection,purpose:'ticket_reporter_upgrade'});
export const jiraReporterHttp=createJiraTicketWriteHttp({purpose:'ticket_reporter_upgrade',enabled:()=>process.env.AXIOM_JIRA_REPORTER_CONSENT_ENABLED==='true',authorization:reporterAuthorization,readRateKey:async()=>{const actor=await readCurrentJiraTicketAdmin();if(!actor)throw Error('unavailable');return actor.organizationId+':'+actor.userId}});
