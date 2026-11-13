import {it,expect,vi} from 'vitest';
import {createManualReleaseSource} from '../releasePreparation';
import {compileOperationalManifest} from '../kernel';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import type {ManualReleaseTransaction} from '../manualReleaseStore';
const at=Date.parse('2026-11-12T00:00:00Z'),until=new Date(at+60000).toISOString(),d='a'.repeat(64),commit='b'.repeat(40);
const ref=(n:number)=>'platform_evidence_'+String(n).padStart(8,'0')+'-1111-4111-8111-111111111111';
const hashes={workflow:d,build:d,configuration:d,lock:d,schema:d},target={projectId:'prj_fixture',teamId:'team_fixture',environment:'production'};
function bundle(){return {format:1,evidenceId:ref(1),observedAt:new Date(at).toISOString(),expiresAt:until,currentMainCommit:commit,profile:{id:'release-evidence-v1',revision:d,requiredChecks:['Typecheck + Vitest','Type check']},manifest:{format:1,scope:'platform',kind:'release.manual',expiresAt:until,source:{repository:'sahme209/visionxixlabs',branch:'main',commit},target,sourceHashes:hashes,artifactEvidenceId:ref(2),ciEvidence:[{name:'Typecheck + Vitest',receiptId:ref(3),commit},{name:'Type check',receiptId:ref(4),commit}],compatibilityEvidenceId:ref(5),recoveryEvidenceId:ref(6),smokeProfileId:'production-smoke-v1'},checks:[{name:'Typecheck + Vitest',receiptId:ref(3),commit,status:'completed',conclusion:'success'},{name:'Type check',receiptId:ref(4),commit,status:'completed',conclusion:'success'}],artifact:{receiptId:ref(2),commit,target,sourceHashes:hashes,artifactSha256:'c'.repeat(64)},compatibility:{receiptId:ref(5),schemaSha256:d,databaseTargetDigest:'e'.repeat(64),observedAt:new Date(at).toISOString(),expiresAt:until},recovery:{receiptId:ref(6),schemaSha256:d,databaseTargetDigest:'e'.repeat(64),observedAt:new Date(at).toISOString(),expiresAt:until}}}
function compiled(raw:unknown){const value=compileOperationalManifest(raw);if(value.kind!=='release.manual')throw Error('wrong fixture');return value}
function fixture(){let now=at;const value=bundle(),tx={now:async()=>now} as unknown as ManualReleaseTransaction,readBundle=vi.fn(async()=>structuredClone(value)),assertQualified=vi.fn(async()=>{}),source=createManualReleaseSource({readBundle,assertQualified});return {value,tx,source,readBundle,assertQualified,setNow:(v:number)=>{now=v},selection:{manifestEvidenceId:ref(1),expiresAt:new Date(at+30000).toISOString()}}}
it('derives the exact manifest from private evidence, with current qualified binding and bounded expiry',async()=>{
 const f=fixture(),manifest=await f.source.buildCurrentManifest(f.tx,f.selection);expect(manifest).toMatchObject({kind:'release.manual',expiresAt:f.selection.expiresAt,source:{commit}});expect(f.assertQualified).toHaveBeenCalledWith(f.tx,ref(1),sha256ContentHash(f.value));
 await f.source.assertCurrent(f.tx,compiled(manifest),f.selection);
});
it('rejects incomplete/failed/foreign CI, wrong source/artifact/target/schema and recovery mismatch',async()=>{
 for(const change of [(v:ReturnType<typeof bundle>)=>{v.checks.pop()},(v:ReturnType<typeof bundle>)=>{v.checks[0].conclusion='failure'},(v:ReturnType<typeof bundle>)=>{v.checks[0].receiptId=ref(9)},(v:ReturnType<typeof bundle>)=>{v.currentMainCommit='f'.repeat(40)},(v:ReturnType<typeof bundle>)=>{v.artifact.commit='f'.repeat(40)},(v:ReturnType<typeof bundle>)=>{v.artifact.target={...target,projectId:'other'}},(v:ReturnType<typeof bundle>)=>{v.artifact.sourceHashes={...hashes,configuration:'f'.repeat(64)}},(v:ReturnType<typeof bundle>)=>{v.compatibility.schemaSha256='f'.repeat(64)},(v:ReturnType<typeof bundle>)=>{v.recovery.databaseTargetDigest='f'.repeat(64)},(v:ReturnType<typeof bundle>)=>{v.profile.requiredChecks=['Type check']}]){
  const f=fixture();change(f.value);await expect(f.source.buildCurrentManifest(f.tx,f.selection)).rejects.toThrow();
 }
});
it('rejects caller extras, stale evidence, expired/revoked private supplier and changed reviewed manifest',async()=>{
 const f=fixture(),extra={...f.selection,ownerApproved:true};await expect(f.source.buildCurrentManifest(f.tx,extra)).rejects.toThrow();
 f.setNow(at+60000);await expect(f.source.buildCurrentManifest(f.tx,f.selection)).rejects.toThrow();f.setNow(at);
 f.assertQualified.mockRejectedValueOnce(Error('profile revoked'));await expect(f.source.buildCurrentManifest(f.tx,f.selection)).rejects.toThrow();
 const manifest=await f.source.buildCurrentManifest(f.tx,f.selection);f.value.manifest.sourceHashes={...hashes,configuration:'f'.repeat(64)};f.value.artifact.sourceHashes={...f.value.manifest.sourceHashes};await expect(f.source.assertCurrent(f.tx,compiled(manifest),f.selection)).rejects.toThrow();
});
it('rechecks qualification and database time after awaited evidence reads',async()=>{
 const f=fixture();f.assertQualified.mockImplementationOnce(async()=>{f.setNow(at+60000)});await expect(f.source.buildCurrentManifest(f.tx,f.selection)).rejects.toThrow();
});
