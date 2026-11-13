import 'server-only';
interface Sql{$queryRawUnsafe<T=unknown>(sql:string,...values:unknown[]):Promise<T>}
/** Metadata only. Both final authorization and preparation use the same
 * exact durable lineage; ambiguous/missing historical records remain blocked. */
export async function readPlatformDeletionSource(sql:Sql,draftId:string,connectionId:string){
 const drafts=await sql.$queryRawUnsafe<unknown[]>('SELECT id,status,"linkedinPostUrn","updatedAt" FROM "LinkedInPostDraft" WHERE id=$1 FOR SHARE',draftId);
 const connections=await sql.$queryRawUnsafe<unknown[]>('SELECT id,"linkedinUrn","organizationUrn",scopes,status,"expiresAt","updatedAt" FROM "LinkedInAccountConnection" WHERE id=$1 FOR SHARE',connectionId);
 const publications=await sql.$queryRawUnsafe<Array<{actionId:string;state:unknown;outcome:string;postUrn:string}>>(`SELECT a.id AS "actionId",a."stateJson" AS state,p.outcome,p."linkedinPostUrn" AS "postUrn" FROM "LinkedInPostPublishRun" p JOIN "PlatformGovernanceAction" a ON a.id=p."diagnosticsJson"->>'platformActionId' JOIN "LinkedInPostDraft" d ON d.id=p."draftId" AND d."linkedinPostUrn"=p."linkedinPostUrn" WHERE d.id=$1 AND p.outcome='success' FOR SHARE OF a,p,d`,draftId);
 if(drafts.length!==1||connections.length!==1||publications.length!==1)throw Error('platform_deletion_source_unavailable');
 return {draft:drafts[0],connection:connections[0],publication:publications[0]};
}
