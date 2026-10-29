import 'server-only';
import {prisma} from '@/lib/db';
import {resolveRequestDesktopSession} from '@/lib/desktop/resolveRequestDesktopSession';
import {encryptScopedCredential,decryptScopedCredential} from '@/lib/security/credentialVault';
import {checkEntitlement} from '@/lib/billing/checkEntitlement';
import {planForStripeTier} from '@/lib/billing/planRegistry';
import {isBillingTier} from '@/lib/billing/tierCatalog';
import {publicPricingForStoredRow} from '@/lib/billing/publicBillingEntitlements';
import type {PublicSql} from '@/lib/billing/publicBillingStore';
import {type NextRequest,NextResponse} from 'next/server';
import {createGcpGuidedService,gcpGuidedRandom,gcpGuidedId,type GuidedRepo} from './service';
import {GcpGuidedError,type GuidedPrincipal} from './contract';
import {exchangeGcpGuided,gcpGuidedConfiguration,listGcpGuidedProjects,verifyGcpGuidedProject} from './provider';
import {assertGcpGuidedAuthority} from './authority';
export const gcpGuided=createGcpGuidedService(prisma as unknown as GuidedRepo,{diagnostic:entry=>console.info('axiom.gcp.guided.failure',entry),now:()=>new Date(),random:gcpGuidedRandom,id:gcpGuidedId,configuration:gcpGuidedConfiguration,assertCurrent:assertGcpGuidedAuthority,seal:encryptScopedCredential,open:decryptScopedCredential,exchange:exchangeGcpGuided,projects:listGcpGuidedProjects,verify:verifyGcpGuidedProject,assertCapacity:async(db,organizationId)=>{const tx=db as unknown as typeof prisma;const row=await tx.tenantBillingPlan.findUnique({where:{organizationId}}),usage=await tx.cloudAccount.count({where:{organizationId}});if(!Number.isSafeInteger(usage)||usage<0||(row&&row.organizationId!==organizationId))throw new GcpGuidedError('gcp_guided_unavailable');const valid=row&&['trialing','active','past_due','canceled','no_plan'].includes(row.status);const tier=row&&isBillingTier(row.tier)&&valid&&row.tier!=='trial'&&row.status!=='trialing'?row.tier:'trial';if(checkEntitlement({plan:await publicPricingForStoredRow(tx as unknown as PublicSql,organizationId,row)??planForStripeTier(tier),dimension:'cloud_accounts',currentUsage:usage,attemptedDelta:1}).kind!=='allow')throw new GcpGuidedError('gcp_guided_unavailable')},});
export async function guidedPrincipal(request:NextRequest){const s=await resolveRequestDesktopSession(request,{requiredScope:'pipeline:trigger',requiredCapability:'connections:manage',allowApiKey:false,route:`${request.method} ${request.nextUrl.pathname}`});if(!s||s.credentialKind!=='desktop_session')throw new GcpGuidedError('gcp_guided_authority_required');return{organizationId:String(s.organizationId),userId:String(s.userId),sessionId:s.id}}
export function guidedFailure(e:unknown){const code=e instanceof GcpGuidedError?e.code:'gcp_guided_unavailable';return NextResponse.json({ok:false,error:code,retryAllowed:false},{status:code==='gcp_guided_invalid'?400:code==='gcp_guided_authority_required'?401:code==='gcp_guided_conflict'?409:503,headers:{'Cache-Control':'private, no-store'}})}
export const guidedReply=(data:unknown)=>NextResponse.json({ok:true,data},{headers:{'Cache-Control':'private, no-store'}});
