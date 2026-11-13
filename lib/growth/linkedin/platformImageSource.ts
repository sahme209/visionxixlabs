import 'server-only';
import {prisma} from '@/lib/db';
import {readImagePublicationSource} from '@/lib/governance/platform/imagePublicationSource';
import type {PlatformSql} from '@/lib/governance/platform/sqlRepository';
import type {PostingConnection} from './platformPostingPlan';
/** Only image posts need the new proposed local upload tables. Legacy text
 * snapshots retain their exact meaning; no provider or key lookup occurs. */
export async function readDefaultImagePublicationSource(connection:PostingConnection,imageUrn:string|null){
 if(imageUrn===null)return undefined;
 return prisma.$transaction(tx=>readImagePublicationSource(tx as unknown as PlatformSql,connection,imageUrn),{isolationLevel:'ReadCommitted',timeout:5000,maxWait:5000});
}
