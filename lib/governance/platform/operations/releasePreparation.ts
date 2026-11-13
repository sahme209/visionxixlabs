import 'server-only';
import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {digest} from '../contracts';
import {operationalEvidenceId,operationalReleaseManifest} from './contracts';
import {manualReleaseSelection,type ManualReleaseSource,type ManualReleaseTransaction} from './manualReleaseStore';
import {compileOperationalManifest,readOperationalManifest} from './kernel';
const stamp=z.string().max(40).datetime(),commit=z.string().regex(/^[a-f0-9]{40}$/),name=z.string().min(1).max(128).refine(v=>v.trim()===v&&!/[\x00-\x1f]/.test(v));
const validity={observedAt:stamp,expiresAt:stamp};
const compatibility=z.object({receiptId:operationalEvidenceId,schemaSha256:digest,databaseTargetDigest:digest,...validity}).strict();
const bundleSchema=z.object({format:z.literal(1),evidenceId:operationalEvidenceId,...validity,currentMainCommit:commit,
 profile:z.object({id:z.string().regex(/^[-A-Za-z0-9_]{1,128}$/),revision:digest,requiredChecks:z.array(name).min(1).max(64)}).strict(),
 manifest:operationalReleaseManifest,
 checks:z.array(z.object({name,receiptId:operationalEvidenceId,commit,status:z.literal('completed'),conclusion:z.literal('success')}).strict()).min(1).max(64),
 artifact:z.object({receiptId:operationalEvidenceId,commit,target:operationalReleaseManifest.shape.target,sourceHashes:operationalReleaseManifest.shape.sourceHashes,artifactSha256:digest}).strict(),
 compatibility,recovery:compatibility,
}).strict();
/** Server-private evidence supplier. readBundle must be read-only and transaction-
 * bound. assertQualified must independently establish the exact immutable bundle
 * digest and current actual source/profile authority. Parsing, a stored boolean,
 * screenshot, source commit or test implementation cannot supply that authority.
 * No default supplier is currently qualified; request data cannot install one. */
export interface ManualReleaseEvidenceSupplier{
 readBundle(tx:ManualReleaseTransaction,evidenceId:string):Promise<unknown>;
 assertQualified(tx:ManualReleaseTransaction,evidenceId:string,bundleDigest:string):Promise<void>;
}
const fail=():never=>{throw Error('manual_release_evidence_unavailable')};
function same(a:unknown,b:unknown){return sha256ContentHash(a)===sha256ContentHash(b)}
export function createManualReleaseSource(supplier:ManualReleaseEvidenceSupplier):ManualReleaseSource{
 async function read(tx:ManualReleaseTransaction,raw:unknown){
  const selection=manualReleaseSelection.parse(raw),original=await supplier.readBundle(tx,selection.manifestEvidenceId),bundle=bundleSchema.parse(original),binding=sha256ContentHash(bundle);
  if(bundle.evidenceId!==selection.manifestEvidenceId)fail();
  await supplier.assertQualified(tx,bundle.evidenceId,binding);
  const manifest=bundle.manifest,required=bundle.profile.requiredChecks;
  if(!required.includes('Typecheck + Vitest')||new Set(required).size!==required.length||bundle.checks.length!==required.length||manifest.ciEvidence.length!==required.length||new Set(bundle.checks.map(c=>c.name)).size!==required.length)fail();
  for(const check of bundle.checks){const reference=manifest.ciEvidence.find(c=>c.name===check.name);if(!required.includes(check.name)||!reference||reference.receiptId!==check.receiptId||check.commit!==manifest.source.commit||reference.commit!==check.commit)fail()}
  const artifact=bundle.artifact;
  if(bundle.currentMainCommit!==manifest.source.commit||artifact.commit!==manifest.source.commit||artifact.receiptId!==manifest.artifactEvidenceId||!same(artifact.target,manifest.target)||!same(artifact.sourceHashes,manifest.sourceHashes))fail();
  if(bundle.compatibility.receiptId!==manifest.compatibilityEvidenceId||bundle.recovery.receiptId!==manifest.recoveryEvidenceId||bundle.compatibility.schemaSha256!==manifest.sourceHashes.schema||bundle.recovery.schemaSha256!==manifest.sourceHashes.schema||bundle.compatibility.databaseTargetDigest!==bundle.recovery.databaseTargetDigest)fail();
  // Recheck the same immutable receipt binding after awaited inspection. No
  // receipt/source/profile mutation is silently accepted as the prior review.
  await supplier.assertQualified(tx,bundle.evidenceId,binding);
  const now=await tx.now(),end=Date.parse(selection.expiresAt);
  if(!Number.isSafeInteger(now)||now<0||end<=now)fail();
  for(const window of [bundle,bundle.compatibility,bundle.recovery])if(Date.parse(window.observedAt)>now||Date.parse(window.expiresAt)<=now||Date.parse(window.observedAt)>=Date.parse(window.expiresAt)||end>Date.parse(window.expiresAt))fail();
  if(end>Date.parse(manifest.expiresAt))fail();
  const periods=[bundle,bundle.compatibility,bundle.recovery],window=Object.freeze({notBefore:Math.max(...periods.map(v=>Date.parse(v.observedAt))),expiresAt:Math.min(...periods.map(v=>Date.parse(v.expiresAt)))});
  return {manifest:operationalReleaseManifest.parse({...manifest,expiresAt:selection.expiresAt}),window};
 }
 return Object.freeze<ManualReleaseSource>({buildCurrentManifest:async(tx,selection)=>(await read(tx,selection)).manifest,async readTimeWindow(tx,rawManifest,selection){
  const manifest=readOperationalManifest(rawManifest),value=await read(tx,selection);if(manifest.kind!=='release.manual'||!same(compileOperationalManifest(value.manifest),manifest))return fail();return value.window;
 },async assertCurrent(tx,rawManifest,selection){
  const manifest=readOperationalManifest(rawManifest);if(manifest.kind!=='release.manual')fail();
  const rebuilt=compileOperationalManifest((await read(tx,selection)).manifest);if(!same(rebuilt,manifest))fail();
 }});
}
