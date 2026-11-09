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
