import 'server-only';
import {createHash} from 'node:crypto';
import {readPlatformTemplateBytes} from '@/lib/cloud/aws/platformTemplateSource';
import {templateBucketEffect,templateObjectEffect,templateAccessEffect} from '@/lib/cloud/aws/platformTemplatePlan';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {platformTemplateSelection} from './templateContract';
import {compilePlatformPlan} from './kernel';
import type {PlatformEffect,PlatformPlan} from './contracts';
const fail=():never=>{throw Error('platform_template_preparation_unavailable')};
/** Server source only. Account/version/recipient are explicit requested targets,
 * not observed provider ownership, version presence or recipient authentication.
 * Actual STS/readback and current execution authority remain mandatory. */
export async function prepareTemplatePlatformPlan(raw:unknown,now:number){
 const selected=platformTemplateSelection.parse(raw);
 if(!Number.isSafeInteger(now)||now<0||Date.parse(selected.expiresAt)<=now)fail();
 let effect:PlatformEffect;
 if(selected.operation==='create_bucket'){
  if(selected.region==='us-east-1')fail();effect=templateBucketEffect(selected.accountId,selected.region);
 }else{
  const bytes=await readPlatformTemplateBytes(),bytesDigest=createHash('sha256').update(bytes).digest('hex');
  effect=selected.operation==='upload'?templateObjectEffect(selected.accountId,selected.region,bytesDigest):templateAccessEffect({...selected,bytesDigest});
 }
 return compilePlatformPlan({format:1,scope:'platform',sourceDigest:sha256ContentHash({kind:'platform_template_source_v1',effect}),expiresAt:selected.expiresAt,effects:[effect]});
}
/** Reference reuse compares only the original selection. Never reread content,
 * renew expiry or fabricate an observation while looking up the old action. */
export function matchesTemplateSelection(plan:PlatformPlan,raw:unknown){
 const selected=platformTemplateSelection.parse(raw);if(plan.effects.length!==1)return false;
 const effect=plan.effects[0];if(effect.kind!=='template.bucket.create'&&effect.kind!=='template.object.put'&&effect.kind!=='template.access.grant')return false;
 const operation=effect.kind==='template.bucket.create'?'create_bucket':effect.kind==='template.object.put'?'upload':'access';
 const original={operation,accountId:effect.target.accountId,region:effect.target.region,expiresAt:new Date(plan.expiresAt).toISOString(),...(effect.kind==='template.access.grant'?{objectVersion:effect.target.objectVersion,recipientDigest:effect.target.recipientDigest,ttlSeconds:effect.target.ttlSeconds}:{})};
 return sha256ContentHash(original)===sha256ContentHash({...selected,expiresAt:new Date(selected.expiresAt).toISOString()});
}
