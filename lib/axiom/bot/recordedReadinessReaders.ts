import 'server-only';
import {hasDesktopCapability,type DesktopWorkspaceRole} from '../../desktop/desktopAuthorization';
import {parseReadinessFacts,type ReadinessFacts} from './readonlyRunContract';
import type {ReadinessReaders} from './readonlyRunWorker';
import type {SavedBotTaskScope} from './savedTaskRepo';
type ConnectionRow={provider:string;status:string;lastValidatedAt:Date|null};
export interface RecordedReadinessRepo {
 orgMembership:{findUnique(args:{where:{userId_organizationId:{userId:string;organizationId:string}};select:{role:true;acceptedAt:true}}):Promise<{role:string;acceptedAt:Date|null}|null>};
 connectorSetupSession:{findMany(args:{where:{organizationId:string;provider:{in:string[]}};take:number;select:{provider:true;status:true;lastTransitionAt:true}}):Promise<Array<{provider:string;status:string;lastTransitionAt:Date}>>};
 tenantIntegrationConnection:{findMany(args:{where:{organizationId:string;provider:{in:string[]}};take:number;select:{provider:true;status:true;lastValidatedAt:true}}):Promise<ConnectionRow[]>};
 gitHubInstallation:{findFirst(args:{where:{organizationId:string};orderBy:{installedAt:'desc'};select:{status:true;lastSeenAt:true}}):Promise<{status:string;lastSeenAt:Date|null}|null>};
 tauriDeploymentRequest:{findMany(args:{where:{organizationId:string};orderBy:Array<{updatedAt:'desc'}|{id:'desc'}>;take:number;select:{id:true;status:true;version:true;updatedAt:true}}):Promise<Array<{id:string;status:string;version:number;updatedAt:Date}>>};
}
export type ReadinessCommercialReader=(organizationId:string,signal:AbortSignal)=>Promise<{available:boolean;allowed:boolean;code:ReadinessFacts['access']['code']}>;
const roles:readonly string[]=['owner','admin','operator','security_reviewer','finance_viewer','read_only'];
const clouds=['aws','azure','gcp'],collaboration=['slack','teams','linear','jira','servicenow'];
const states:readonly string[]=['active','connected','pending','awaiting_validation','needs_attention','suspended','revoked','not_connected','unknown'];
function check(scope:SavedBotTaskScope,signal:AbortSignal){if(signal.aborted||!scope.organizationId.trim()||!scope.userId.trim())throw new Error('recorded_read_unavailable')}
function timestamp(value:Date|null):string|null{return value instanceof Date&&Number.isFinite(value.getTime())?value.toISOString():null}
function connection(provider:string,status:string,date:Date|null):ReadinessFacts['integrations']['items'][number]{
 const recordedAt=timestamp(date);let visible=states.includes(status)?status:'unknown';
 if(recordedAt&&date!.getTime()>Date.now())visible='unknown';
 else if((status==='active'||status==='connected')&&!recordedAt)visible='awaiting_validation';
 else if((status==='active'||status==='connected')&&date&&Date.now()-date.getTime()>86400000)visible='needs_attention';
 return {provider:provider as ReadinessFacts['integrations']['items'][number]['provider'],status:visible as ReadinessFacts['integrations']['items'][number]['status'],recordedAt};
}
function validateIntegrations(value:ReadinessFacts['integrations']){return parseReadinessFacts({checkedAt:new Date().toISOString(),access:{role:'read_only',code:'active'},integrations:value,releases:{availability:'absent',items:[],truncated:false}}).integrations}
function validateReleases(value:ReadinessFacts['releases']){return parseReadinessFacts({checkedAt:new Date().toISOString(),access:{role:'read_only',code:'active'},integrations:{availability:'absent',items:[]},releases:value}).releases}
/** Purely recorded workspace inventory. Does not load credential columns, decrypt,
 * bootstrap membership, touch sessions, or call providers or health aggregates. */
export function createRecordedReadinessReaders(repo:RecordedReadinessRepo,readCommercial:ReadinessCommercialReader):ReadinessReaders {
 return {
  async readAccess(scope,signal){
   check(scope,signal);const membership=await repo.orgMembership.findUnique({where:{userId_organizationId:{userId:scope.userId,organizationId:scope.organizationId}},select:{role:true,acceptedAt:true}});check(scope,signal);
   if(membership&&!roles.includes(membership.role))throw new Error('recorded_read_unavailable');
   const role=(membership?.role??'read_only') as DesktopWorkspaceRole;
   const commercial=await readCommercial(scope.organizationId,signal);check(scope,signal);
   if(!commercial.available)throw new Error('recorded_read_unavailable');
   const accepted=Boolean(membership?.acceptedAt&&Number.isFinite(membership.acceptedAt.getTime()));
   return {accepted,canRead:accepted&&commercial.allowed&&hasDesktopCapability(role,'workspace:read'),role,commercialCode:commercial.code};
  },
  async readIntegrations(scope,signal){
   check(scope,signal);
   try{
    const cloud=await repo.connectorSetupSession.findMany({where:{organizationId:scope.organizationId,provider:{in:[...clouds]}},take:4,select:{provider:true,status:true,lastTransitionAt:true}});check(scope,signal);
    const collaborationRows=await repo.tenantIntegrationConnection.findMany({where:{organizationId:scope.organizationId,provider:{in:[...collaboration]}},take:6,select:{provider:true,status:true,lastValidatedAt:true}});check(scope,signal);
    const github=await repo.gitHubInstallation.findFirst({where:{organizationId:scope.organizationId},orderBy:{installedAt:'desc'},select:{status:true,lastSeenAt:true}});check(scope,signal);
    if(cloud.length>3||collaborationRows.length>5||cloud.some(r=>!clouds.includes(r.provider))||collaborationRows.some(r=>!collaboration.includes(r.provider)))throw new Error('invalid_recorded_inventory');
    const items=[...cloud.map(r=>connection(r.provider,r.status,r.lastTransitionAt)),...collaborationRows.map(r=>connection(r.provider,r.status,r.lastValidatedAt)),...(github?[connection('github',github.status,github.lastSeenAt)]:[])];
    if(new Set(items.map(r=>r.provider)).size!==items.length)throw new Error('invalid_recorded_inventory');
    return validateIntegrations({availability:items.length?'recorded':'absent',items});
   }catch{check(scope,signal);return {availability:'unavailable',items:[]}}
  },
  async readReleases(scope,signal){
   check(scope,signal);
   try{
    const rows=await repo.tauriDeploymentRequest.findMany({where:{organizationId:scope.organizationId},orderBy:[{updatedAt:'desc'},{id:'desc'}],take:26,select:{id:true,status:true,version:true,updatedAt:true}});check(scope,signal);
    if(rows.length>26)throw new Error('invalid_recorded_inventory');
    const items=rows.slice(0,25).map(r=>({id:r.id,status:(['draft','submitted','closed'].includes(r.status)?r.status:'unknown') as ReadinessFacts['releases']['items'][number]['status'],version:r.version,recordedAt:timestamp(r.updatedAt)??''}));
    return validateReleases({availability:items.length?'recorded':'absent',items,truncated:rows.length>25});
   }catch{check(scope,signal);return {availability:'unavailable',items:[],truncated:false}}
  }
 };
}
