import 'server-only';
import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {withGithubAbort,readBoundedGithubBody} from '@/lib/connectors/github/boundedGithubRead';
import {connectedActionTargetsSchema,connectedActionTeamSchema,type ConnectedActionTargets} from './connectedActionDiscoveryContract';

export function connectedTargetDigest(target:unknown){return sha256ContentHash({kind:'connected_app_target_v1',target})}
export interface ConnectedActionDiscoveryInput{
 provider:'teams'|'linear';organizationId:string;connectionId:string;connectionRevision:string;externalAccountId:string;
 token:string;scopes:string[];expiresAt:number;teamId?:string;issueId?:string;signal:AbortSignal;
 assertCurrent:()=>Promise<void>;fetchImpl?:typeof fetch;now?:()=>number;
}
const uuid=z.string().uuid(),label=z.string().min(1).max(240).refine(v=>!/[\x00-\x1f\x7f-\x9f]/.test(v));
const msHas=(scopes:string[],required:string)=>scopes.some(s=>s.toLowerCase()===required.toLowerCase()||s.toLowerCase()==='https://graph.microsoft.com/'+required.toLowerCase());
/** Bounded fixed reads only. No issue/message mutation, private message history,
 * refresh, automatic pagination, arbitrary GraphQL, URL or client access assertion. */
export async function readConnectedActionTargets(input:ConnectedActionDiscoveryInput):Promise<ConnectedActionTargets>{
 const clock=input.now??Date.now,controller=new AbortController(),signal=AbortSignal.any([input.signal,controller.signal]),timer=setTimeout(()=>controller.abort(),15000);
 try{
  if(!input.token||/[\x00-\x20\x7f-\x9f]/.test(input.token)||input.token.length>32768||!Number.isSafeInteger(input.expiresAt)||input.expiresAt<=clock()+15000)throw Error('connected_action_refresh_required');
  if(input.teamId)uuid.parse(input.teamId);if(input.issueId)uuid.parse(input.issueId);
  if(input.provider==='teams'?!['Team.ReadBasic.All','Channel.ReadBasic.All'].every(s=>msHas(input.scopes,s)):!input.scopes.includes('read'))throw Error('connected_action_permission_required');
  const current=async()=>{signal.throwIfAborted();await withGithubAbort(input.assertCurrent(),signal);signal.throwIfAborted();if(input.expiresAt<=clock()+15000)throw Error('connected_action_refresh_required')};
  const read=async(url:string,body?:unknown)=>{
   await current();let response:Response|undefined;
   try{response=await withGithubAbort((input.fetchImpl??fetch)(url,{method:body?'POST':'GET',redirect:'error',credentials:'omit',cache:'no-store',headers:{Authorization:`Bearer ${input.token}`,accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal}),signal);if(response.redirected||response.url&&response.url!==url||response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw Error('connected_action_read_unavailable');
    const value:unknown=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await readBoundedGithubBody(response.status===200?response:new Response(response.body,{headers:response.headers}),signal,response.status===200?524288:8192)));
    if(response.status!==200){
     // Classify only the exact denial observed from the fixed Microsoft read.
     // Never infer access, retry, expose vendor text or change a subscription.
     const denied=z.object({error:z.object({code:z.literal('Forbidden'),message:z.literal('Failed to get license information for the user. Ensure user has a valid Office365 license assigned to them.')})}).safeParse(value);
     if(input.provider==='teams'&&response.status===403&&denied.success)throw Error('connected_action_teams_license_required');
     throw Error('connected_action_read_unavailable');
    }
    await current();return value}finally{void response?.body?.cancel().catch(()=>{})}
  };
  let result:ConnectedActionTargets;
  if(input.provider==='teams'){
   const workspaceId=uuid.parse(input.externalAccountId);
   const response=z.object({value:z.array(z.object({id:uuid,displayName:label,isArchived:z.boolean()}).passthrough()).max(50),'@odata.nextLink':z.string().optional()}).passthrough().parse(await read('https://graph.microsoft.com/v1.0/me/joinedTeams?$select=id,displayName,isArchived'));
   const teams=response.value.map(t=>({id:t.id,name:t.displayName,archived:t.isArchived}));
   if(new Set(teams.map(t=>t.id)).size!==teams.length)throw Error('connected_action_read_unavailable');
   let channels:ConnectedActionTargets['channels']=[];
   if(input.teamId){const selected=teams.find(t=>t.id===input.teamId);if(!selected||selected.archived)throw Error('connected_action_target_unavailable');const page=z.object({value:z.array(z.object({id:z.string().regex(/^[A-Za-z0-9@._:-]{1,240}$/),displayName:label,membershipType:z.enum(['standard','private','shared'])}).passthrough()).max(100),'@odata.nextLink':z.string().optional()}).passthrough().parse(await read(`https://graph.microsoft.com/v1.0/teams/${input.teamId}/channels?$select=id,displayName,membershipType`));if(page['@odata.nextLink'])throw Error('connected_action_target_page_required');channels=page.value.map(c=>({id:c.id,name:c.displayName,membershipType:c.membershipType}));if(new Set(channels.map(c=>c.id)).size!==channels.length)throw Error('connected_action_read_unavailable')}
   result={provider:'teams',organizationId:input.organizationId,connectionId:input.connectionId,connectionRevision:input.connectionRevision,workspaceId,workspaceName:'Microsoft Teams',observedAt:new Date(clock()).toISOString(),selectedTeamId:input.teamId??null,teams,channels,states:[],issues:[],hasMore:!!response['@odata.nextLink'],canCreate:false,canUpdate:false,canMessage:msHas(input.scopes,'ChannelMessage.Send')};
  }else{
   const response=z.object({data:z.object({viewer:z.object({id:uuid}),organization:z.object({id:uuid,name:label}),teams:z.object({nodes:z.array(z.object({id:uuid,name:label,key:label})).max(50),pageInfo:z.object({hasNextPage:z.boolean()})})}),errors:z.array(z.unknown()).optional()}).parse(await read('https://api.linear.app/graphql',{query:'query AxiomActionTargets { viewer { id } organization { id name } teams(first: 50) { nodes { id name key } pageInfo { hasNextPage } } }'}));
   if(response.errors?.length||response.data.viewer.id!==input.externalAccountId)throw Error('connected_action_identity_changed');
   const data=response.data,teams=data.teams.nodes.map(t=>connectedActionTeamSchema.parse(t));if(new Set(teams.map(t=>t.id)).size!==teams.length)throw Error('connected_action_read_unavailable');
   let states:ConnectedActionTargets['states']=[],issues:ConnectedActionTargets['issues']=[],hasMore=data.teams.pageInfo.hasNextPage;
   if(input.teamId){if(!teams.some(t=>t.id===input.teamId))throw Error('connected_action_target_unavailable');
    const issueFields='id identifier title updatedAt team { id } state { id }';
    const query=input.issueId?`query AxiomSelectedIssue($teamId: String!, $issueId: String!) { team(id: $teamId) { id states { nodes { id name type } } } issue(id: $issueId) { ${issueFields} } }`:`query AxiomTeamIssues($teamId: String!) { team(id: $teamId) { id states { nodes { id name type } } issues(first: 20) { nodes { ${issueFields} } pageInfo { hasNextPage } } } }`;
    const payload=z.object({data:z.record(z.string(),z.unknown()),errors:z.array(z.unknown()).optional()}).parse(await read('https://api.linear.app/graphql',{query,variables:{teamId:input.teamId,...(input.issueId?{issueId:input.issueId}:{})}}));if(payload.errors?.length)throw Error('connected_action_read_unavailable');
    const team=z.object({id:z.literal(input.teamId),states:z.object({nodes:z.array(z.object({id:uuid,name:label,type:label})).max(100)}),issues:z.object({nodes:z.array(z.unknown()).max(20),pageInfo:z.object({hasNextPage:z.boolean()})}).optional()}).parse(payload.data.team);states=team.states.nodes;
    const issue=z.object({id:uuid,identifier:label,title:label,updatedAt:z.string().datetime(),team:z.object({id:z.literal(input.teamId)}),state:z.object({id:uuid})});const records=input.issueId?[payload.data.issue]:team.issues?.nodes;if(!records)throw Error('connected_action_read_unavailable');issues=records.map(v=>{const i=issue.parse(v);if(input.issueId&&i.id!==input.issueId)throw Error('connected_action_target_unavailable');return{id:i.id,identifier:i.identifier,title:i.title,updatedAt:i.updatedAt,stateId:i.state.id}});hasMore=hasMore||!!team.issues?.pageInfo.hasNextPage;
    if(new Set(states.map(s=>s.id)).size!==states.length||new Set(issues.map(i=>i.id)).size!==issues.length)throw Error('connected_action_read_unavailable');
   }
   result={provider:'linear',organizationId:input.organizationId,connectionId:input.connectionId,connectionRevision:input.connectionRevision,workspaceId:data.organization.id,workspaceName:data.organization.name,observedAt:new Date(clock()).toISOString(),selectedTeamId:input.teamId??null,teams,channels:[],states,issues,hasMore,canCreate:input.scopes.includes('issues:create')||input.scopes.includes('write'),canUpdate:input.scopes.includes('write'),canMessage:false};
  }
  await current();return connectedActionTargetsSchema.parse(result);
 }finally{clearTimeout(timer);controller.abort()}
}
