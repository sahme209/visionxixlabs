import 'server-only';
import type {PlatformSql} from './sqlRepository';
import {createImageStorageSql} from './imageStorageSql';
import {platformActionId} from './viewContract';
const fail=():never=>{throw Error('platform_image_publication_source_unavailable')};
/** Read existing confirmed upload only; never initialize/upload/decrypt a grant
 * or acquire a credential. Private SQL result is metadata, not a native claim. */
export async function readImagePublicationSource(sql:PlatformSql,connection:{id:string;linkedinUrn:string;organizationUrn:string|null},imageUrn:string){
 if(!/^urn:li:image:[A-Za-z0-9_-]{1,256}$/.test(imageUrn))return fail();
 const rows=await sql.$queryRawUnsafe<Array<{actionId:string}>>(`SELECT "actionId" FROM "PlatformImageUploadGrant" WHERE "contextJson"->'binding'->'artifact'->>'connectionId'=$1 AND "contextJson"->'native'->>'providerImageReference'=$2 LIMIT 2 FOR SHARE`,connection.id,imageUrn);
 if(rows.length!==1)return fail();const id=platformActionId.parse(rows[0].actionId);
 const parent=await sql.$queryRawUnsafe<Array<{id:string}>>('SELECT id FROM "PlatformGovernanceAction" WHERE id=$1 FOR SHARE',id);if(parent.length!==1||parent[0].id!==id)return fail();
 const value=await createImageStorageSql(sql,()=>id).confirmedPublication();
 const author=connection.organizationUrn||connection.linkedinUrn;
 if(value.connectionId!==connection.id||value.author!==author||value.providerImageReference!==imageUrn)return fail();
 return value;
}

/** Explicit reuse selection is an original confirmed upload action, never a
 * caller image URN/address. Old approval/grant expiry is historical; current
 * post authority is checked separately and no old privilege is transferred. */
export async function readImagePublicationSourceByAction(sql:PlatformSql,connection:{id:string;linkedinUrn:string;organizationUrn:string|null},rawActionId:string){
 const actionId=platformActionId.parse(rawActionId);
 const rows=await sql.$queryRawUnsafe<Array<{image:string}>>(`SELECT "contextJson"->'native'->>'providerImageReference' AS image FROM "PlatformImageUploadGrant" WHERE "actionId"=$1 LIMIT 2 FOR SHARE`,actionId);
 if(rows.length!==1)return fail();const lineage=await readImagePublicationSource(sql,connection,rows[0].image);if(lineage.uploadActionId!==actionId)return fail();return lineage;
}
export async function readReadyImageArtifactSource(sql:PlatformSql,connection:{id:string;linkedinUrn:string;organizationUrn:string|null},actionId:string){
 const lineage=await readImagePublicationSourceByAction(sql,connection,actionId),storage=createImageStorageSql(sql,()=>actionId),grant=await storage.readGrant();if(!grant||grant.context.binding.artifact.bytesDigest!==lineage.bytesDigest)return fail();
 return {lineage,artifact:await storage.artifactMatches(grant.context.binding)};
}
