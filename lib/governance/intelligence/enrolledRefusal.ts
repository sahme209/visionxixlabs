import 'server-only';
import {prisma} from '@/lib/db';
import {assertNoGovernanceEnrollmentForMutation} from './enrollmentMetadata';
import {isSafetyNotification,isSafetyWebhook} from './enrolledRefusalPolicy';

/** True unless the workspace is enrolled (or enrollment cannot be read). Refusal only; never grants anything. */
export async function workspaceUnenrolled(organizationId:string):Promise<boolean>{
 try{await assertNoGovernanceEnrollmentForMutation(prisma,organizationId);return true}catch{return false}
}

/** F17: safety alerts always deliver; discretionary sends are refused while enrolled. */
export async function mayDeliverTenantNotification(organizationId:string,n:{kind?:string|null;severity?:string|null;outcome?:string|null}):Promise<boolean>{
 if(isSafetyNotification(n))return true;
 return workspaceUnenrolled(organizationId);
}

/** F18: security webhooks always deliver; other tenant webhooks wait while enrolled. */
export async function mayDeliverTenantWebhook(organizationId:string,eventKind:string):Promise<boolean>{
 if(isSafetyWebhook(eventKind))return true;
 return workspaceUnenrolled(organizationId);
}

/**
 * M03: true when starting this connection must be refused: the workspace has no
 * connection for the provider yet (so this would add one) and it is enrolled or
 * enrollment cannot be read. Re-authorizing an existing connection is allowed.
 * Call it before any provider consent redirect, so nobody grants access that
 * Axiom would then have to discard.
 */
export async function refuseNewConnectionWhenEnrolled(organizationId:string,provider:string):Promise<boolean>{
 let existing:unknown;
 try{existing=await prisma.tenantIntegrationConnection.findUnique({where:{organizationId_provider:{organizationId,provider}},select:{id:true}})}catch{return true}
 if(existing)return false;
 return !await workspaceUnenrolled(organizationId);
}
