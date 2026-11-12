import 'server-only';
import {templateBucketEffect} from '@/lib/cloud/aws/platformTemplatePlan';
import {createHash} from 'node:crypto';
import {readPlatformTemplateBytes} from '@/lib/cloud/aws/platformTemplateSource';
import {readDeploymentPlatformSource} from './deploymentPreparation';
import {preparePlatformLinkedInDeletion} from '@/lib/growth/linkedin/platformDeletionPlan';
import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {preparePlatformLinkedInPost,preparePlatformLinkedInSchedule,currentLinkedInVersion,postingDraftSchema,postingConnectionSchema} from '@/lib/growth/linkedin/platformPostingPlan';
import {isPostingEnabled} from '@/lib/growth/linkedin/oauth';
import {platformPrincipalSchema} from './contracts';
import type {PlatformAuthority} from './actionStore';
const rowSchema=platformPrincipalSchema.extend({email:z.string().email().max(320),live:z.literal(true)}).strict();
const fail=():never=>{throw Error('platform_governance_authority_unavailable')};
/** Platform privilege is the current deployment-admin allowlist, never a
 * customer workspace role. A paired session still requires current membership
 * for its own validity; that workspace is not the platform action's owner. */
export function createCurrentPlatformAuthority(readAdminEmails:()=>readonly string[]):PlatformAuthority{
 return {async assertCurrent(tx,raw){
  await assertCurrentPlatformPrincipal(tx,raw,readAdminEmails);
 },async assertEffectCurrent(tx,effect){
  if(effect.kind==='template.bucket.create'){
   if(effect.target.region!=='us-east-2'||sha256ContentHash(templateBucketEffect(effect.target.accountId,effect.target.region,effect.id))!==sha256ContentHash(effect))fail();return;
  }
  if(effect.kind==='template.object.put'||effect.kind==='template.access.grant'){
   const bytes=await readPlatformTemplateBytes();
   if(createHash('sha256').update(bytes).digest('hex')!==effect.target.bytesDigest)fail();return;
  }
  if(effect.kind==='deployment.vercel'&&effect.target.leadId){
   const prepared=await readDeploymentPlatformSource(tx,{leadId:effect.target.leadId,projectName:effect.target.projectName,environment:effect.target.environment},effect.id);
   if(sha256ContentHash(prepared.effect)!==sha256ContentHash(effect))fail();return;
  }
  if(!effect.kind.startsWith('growth.'))return;
  if(effect.kind==='growth.post.delete'){
   if(!isPostingEnabled())fail();const read=tx.readGrowthDeletionSource??fail(),source=await read.call(tx,effect.target.draftId,effect.target.connectionId),version=currentLinkedInVersion();
   const prepared=preparePlatformLinkedInDeletion(source,version,await tx.now(),effect.id);
   if(!isPostingEnabled()||currentLinkedInVersion()!==version||sha256ContentHash(prepared.effect)!==sha256ContentHash(effect))fail();return;
  }
  if((effect.kind!=='growth.post.publish'&&effect.kind!=='growth.schedule.change')||!isPostingEnabled())fail();
  if(effect.kind!=='growth.post.publish'&&effect.kind!=='growth.schedule.change')return fail();
  const source=z.object({draft:postingDraftSchema,connection:postingConnectionSchema}).strict().parse(await tx.readGrowthPostingSource(effect.target.draftId,effect.target.connectionId));
  const version=currentLinkedInVersion(),now=await tx.now(),prepared=effect.kind==='growth.post.publish'?preparePlatformLinkedInPost(source.draft,source.connection,version,now,effect.id):preparePlatformLinkedInSchedule(source.draft,source.connection,version,now,new Date(effect.target.scheduledFor),effect.id);
  if(!isPostingEnabled()||currentLinkedInVersion()!==version||sha256ContentHash(prepared.effect)!==sha256ContentHash(effect))fail();
 }};
}
export function readConfiguredPlatformAdmins():readonly string[]{return (process.env.ADMIN_EMAILS??'').split(',')}

/** Same platform-admin/current paired-session rule for dedicated platform records. */
export async function assertCurrentPlatformPrincipal(tx:Pick<import('./actionStore').PlatformTransaction,'readPrincipal'>,raw:import('./contracts').PlatformPrincipal,readAdminEmails:()=>readonly string[]){
  const principal=platformPrincipalSchema.parse(raw);
  const allowed=()=>readAdminEmails().map(s=>s.trim().toLowerCase()).filter(Boolean);
  if(!allowed().length)fail();
  const row=rowSchema.parse(await tx.readPrincipal(principal));
  if(row.userId!==principal.userId||row.sessionId!==principal.sessionId||!allowed().includes(row.email.toLowerCase()))fail();
}
