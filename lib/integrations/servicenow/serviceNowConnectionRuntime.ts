import 'server-only';
import {prisma} from '@/lib/db';
import {currentContext} from '@/lib/auth/currentContext';
import {createServiceNowConnectionHttp} from './serviceNowConnectionHttp';
import {createServiceNowTenantConnectionAdapter,type ServiceNowTenantRepository} from './serviceNowTenantConnection';
import {exchangeServiceNowAuthorizationCode} from './serviceNowOAuth';
import {readServiceNowModels} from './serviceNowReadAccess';
import type {TenantConnectionRepo} from '../tenantConnectionRepo';
/** Workspace membership, not a global platform-admin email, owns tenant credentials. */
export async function readCurrentServiceNowActor(){
 const context=await currentContext();
 if(!context.isAuthenticated||!context.organizationId||!context.userId)return null;
 const membership=await prisma.orgMembership.findFirst({where:{organizationId:context.organizationId,userId:context.userId,acceptedAt:{not:null},role:{in:['owner','admin']}},select:{organizationId:true,userId:true,role:true}});
 return membership?{organizationId:membership.organizationId,userId:membership.userId,canManageConnections:true as const}:null;
}
const repo=prisma as unknown as ServiceNowTenantRepository & TenantConnectionRepo;
export const serviceNowConnectionAdapter=createServiceNowTenantConnectionAdapter(repo,{readCurrentActor:readCurrentServiceNowActor});
export const serviceNowConnectionHttp=createServiceNowConnectionHttp({repo,enabled:()=>process.env.AXIOM_SERVICENOW_CONNECTION_ENABLED==='true',readCurrentActor:readCurrentServiceNowActor,...serviceNowConnectionAdapter,exchangeCode:input=>exchangeServiceNowAuthorizationCode({...input,onDiagnostic:diagnostic=>console.warn('servicenow_oauth_failure',diagnostic)}),verifyReadAccess:async(registration,token,signal)=>{await readServiceNowModels({instanceOrigin:registration.instanceOrigin,token,signal,onDiagnostic:diagnostic=>console.warn('servicenow_read_failure',diagnostic)})}});

import {createServiceNowRefreshPersistence,type ServiceNowRefreshRepository} from './serviceNowRefreshPersistence';
import {createServiceNowRefreshHttp} from './serviceNowRefreshHttp';
const refresh=createServiceNowRefreshPersistence(prisma as unknown as ServiceNowRefreshRepository,{readCurrentActor:readCurrentServiceNowActor,fetch});
export const serviceNowRefreshHttp=createServiceNowRefreshHttp({enabled:()=>process.env.AXIOM_SERVICENOW_CONNECTION_ENABLED==='true'&&process.env.AXIOM_SERVICENOW_REFRESH_ENABLED==='true',readCurrentActor:readCurrentServiceNowActor,refresh});
