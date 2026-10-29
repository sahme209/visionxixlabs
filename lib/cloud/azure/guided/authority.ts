import 'server-only';
import {hasDesktopCapability} from '@/lib/desktop/desktopAuthorization';
import {AzureGuidedError,type AzureGuidedPrincipal} from './contract';
import type {AzureGuidedRepo} from './service';
interface AuthorityDb {desktopSessionRecord:{findUnique(args:unknown):Promise<{id:string;userId:string;organizationId:string;revokedAt:Date|null;expiresAt:Date}|null>};orgMembership:{findUnique(args:unknown):Promise<{role:string;acceptedAt:Date|null}|null>};$queryRawUnsafe?<T>(q:string,...values:unknown[]):Promise<T>}
export async function assertAzureGuidedAuthority(db:AzureGuidedRepo,p:AzureGuidedPrincipal){const r=db as unknown as AuthorityDb;
 // Transactions hold these rows through the final mutation; outside a transaction
 // the same reads are repeated at every async authority boundary.
 if(r.$queryRawUnsafe) {const locked=await r.$queryRawUnsafe<Array<{id:string}>>('SELECT "id" FROM "DesktopSessionRecord" WHERE "id"=$1 AND "expiresAt">clock_timestamp() AND "revokedAt" IS NULL FOR SHARE',p.sessionId);if(locked.length!==1)throw new AzureGuidedError('azure_guided_authority_required');await r.$queryRawUnsafe('SELECT "userId" FROM "OrgMembership" WHERE "userId"=$1 AND "organizationId"=$2 FOR SHARE',p.userId,p.organizationId)}
 const session=await r.desktopSessionRecord.findUnique({where:{id:p.sessionId}}),member=await r.orgMembership.findUnique({where:{userId_organizationId:{userId:p.userId,organizationId:p.organizationId}}});
 if(!session||session.id!==p.sessionId||session.userId!==p.userId||session.organizationId!==p.organizationId||session.revokedAt||session.expiresAt<=new Date()||!member?.acceptedAt||(member.role!=='owner'&&member.role!=='admin')||!hasDesktopCapability(member.role==='owner'?'owner':'admin','connections:manage'))throw new AzureGuidedError('azure_guided_authority_required');}
