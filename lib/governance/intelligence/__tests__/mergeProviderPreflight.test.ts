import {expect,it,vi} from 'vitest';
import {createMergeProviderPreflight} from '../mergeProviderPreflight';
import {createReleaseDirectMergeSupportReader} from '@/lib/tauri/releaseDirectMergeSupport';
const now=Date.now(),plan={kind:'merge_pull_request' as const,organizationId:'org',requestId:'release',requestVersion:1,intakeDigest:'f'.repeat(64),connectionId:'connection',connectionRevision:new Date(now-1000).toISOString(),window:{startUtc:new Date(now-1000).toISOString(),endUtc:new Date(now+60000).toISOString()},method:'squash' as const,pullRequest:{repositoryFullName:'team/service',number:42,url:'https://github.com/team/service/pull/42',headRef:'feature',headSha:'a'.repeat(40),baseRef:'main',baseSha:'b'.repeat(40)}};
function fixture(){
 let time=now;
 const credential={organizationId:'org',connectionId:'connection',connectionRevision:plan.connectionRevision,repositoryFullName:'team/service',installationId:'123',token:'PRIVATE_FIXTURE_TOKEN',expiresAt:now+60000,contentsWrite:true as const,pullRequestsRead:true as const};
 const evidence={kind:'verified_unstacked_topology_v1',organizationId:'org',connectionId:'connection',connectionRevision:plan.connectionRevision,repositoryFullName:'team/service',pullRequestNumber:42,headSha:plan.pullRequest.headSha,baseSha:plan.pullRequest.baseSha,evidenceDigest:'e'.repeat(64),observedAt:new Date(now).toISOString(),expiresAt:new Date(now+10000).toISOString()};
 const fetcher=vi.fn(async(url:any)=>Response.json(String(url).includes('/rules/')?[]:String(url).endsWith('/pulls/42')?{number:42,state:'open',draft:false,merged:false,head:{sha:plan.pullRequest.headSha,ref:'feature',repo:{full_name:'team/service'}},base:{sha:plan.pullRequest.baseSha,ref:'main',repo:{full_name:'team/service'}}}:{full_name:'team/service',default_branch:'main',archived:false,disabled:false,allow_merge_commit:true,allow_squash_merge:true,allow_rebase_merge:true}));
 const actualSupport=createReleaseDirectMergeSupportReader({isEnabled:()=>true,assertCurrent:async()=>{},readTopologyEvidence:async()=>evidence,fetch:fetcher as typeof fetch,now:()=>time});
 const ports={assertCurrent:vi.fn(async()=>{}),readCredential:vi.fn(async()=>credential),readDirectMergeSupport:vi.fn(actualSupport),now:()=>time};
 return{ports,credential,evidence,proof:createMergeProviderPreflight(ports),setTime(v:number){time=v;}};
}
it('issues only a private exact-plan expiring proof, with no token in its public result',async()=>{
 const f=fixture(),proof=await f.proof.read(plan,new AbortController().signal);
 expect(JSON.stringify(proof)).not.toContain('PRIVATE_FIXTURE_TOKEN');expect(f.ports.assertCurrent).toHaveBeenCalledTimes(2);
 expect(()=>f.proof.facts({...proof},plan)).toThrow('proof_unavailable');
 expect(f.proof.facts(proof,plan)).toEqual({providerAccessVerified:true,verifiedEvidence:true});
 expect(()=>f.proof.facts(proof,plan)).toThrow('proof_unavailable');
});
it('refuses changed plan, expired proof, wrong credential and changed provider target',async()=>{
 const f=fixture(),p=await f.proof.read(plan,new AbortController().signal);expect(()=>f.proof.facts(p,{...plan,method:'merge'})).toThrow();
 const g=fixture(),q=await g.proof.read(plan,new AbortController().signal);g.setTime(now+5000);expect(()=>g.proof.facts(q,plan)).toThrow();
 const h=fixture();h.credential.repositoryFullName='other/repo';await expect(h.proof.read(plan,new AbortController().signal)).rejects.toThrow();expect(h.ports.readDirectMergeSupport).not.toHaveBeenCalled();
 const j=fixture();j.evidence.headSha='b'.repeat(40);await expect(j.proof.read(plan,new AbortController().signal)).rejects.toThrow();
});
it('rechecks current stored authority after provider reads and never makes a proof after cancellation',async()=>{
 const f=fixture();f.ports.assertCurrent.mockResolvedValueOnce(undefined).mockRejectedValueOnce(Error('revoked'));
 await expect(f.proof.read(plan,new AbortController().signal)).rejects.toThrow('revoked');
 const g=fixture(),abort=new AbortController();abort.abort();await expect(g.proof.read(plan,abort.signal)).rejects.toThrow();expect(g.ports.readCredential).not.toHaveBeenCalled();
});
it('cannot wrap short-lived topology evidence into a fresh five-second proof',async()=>{const f=fixture();f.evidence.expiresAt=new Date(now+10).toISOString();const p=await f.proof.read(plan,new AbortController().signal);expect(p.expiresAt).toBe(now+10);f.setTime(now+10);expect(()=>f.proof.facts(p,plan)).toThrow();});
it('refuses topology evidence which expires during the final awaited store authority check',async()=>{const f=fixture();f.evidence.expiresAt=new Date(now+10).toISOString();f.ports.assertCurrent.mockResolvedValueOnce(undefined).mockImplementationOnce(async()=>{f.setTime(now+10);});await expect(f.proof.read(plan,new AbortController().signal)).rejects.toThrow();});
it('rejects copied or caller-supplied support metadata without actual-reader provenance',async()=>{const f=fixture(),actual=f.ports.readDirectMergeSupport.getMockImplementation()!;f.ports.readDirectMergeSupport.mockImplementation(async(...args)=>({...await actual(...args)} as any));await expect(f.proof.read(plan,new AbortController().signal)).rejects.toThrow('support_evidence_unavailable');});
it('binds actual-reader provenance to exact plan and credential identity',async()=>{
 for(const changed of ['plan','credential']){
  const f=fixture(),actual=f.ports.readDirectMergeSupport.getMockImplementation()!;
  const support=await actual(changed==='plan'?{...plan,method:'merge'}:plan,new AbortController().signal,changed==='credential'?{...f.credential,token:'OTHER_FIXTURE_TOKEN'}:f.credential);
  f.ports.readDirectMergeSupport.mockResolvedValue(support);
  await expect(f.proof.read(plan,new AbortController().signal)).rejects.toThrow('support_evidence_unavailable');
 }
});
it('caps a proof to the original thirty-second topology age boundary',async()=>{
 const f=fixture();f.evidence.observedAt=new Date(now-29000).toISOString();f.evidence.expiresAt=new Date(now+20000).toISOString();
 const p=await f.proof.read(plan,new AbortController().signal);expect(p.expiresAt).toBe(now+1000);
 f.setTime(now+1000);expect(()=>f.proof.facts(p,plan)).toThrow('proof_unavailable');
});
it('refuses issuance when original topology age crosses thirty seconds during final authority await',async()=>{
 const f=fixture();f.evidence.observedAt=new Date(now-29000).toISOString();f.evidence.expiresAt=new Date(now+20000).toISOString();
 f.ports.assertCurrent.mockResolvedValueOnce(undefined).mockImplementationOnce(async()=>{f.setTime(now+1000);});
 await expect(f.proof.read(plan,new AbortController().signal)).rejects.toThrow('provider_unavailable');
});

it('retains the original private provider window after single-use consumption without renewing copied metadata',async()=>{
 const f=fixture(),proof=await f.proof.read(plan,new AbortController().signal),consumed=f.proof.consume(proof,plan);
 expect(consumed.facts).toEqual({providerAccessVerified:true,verifiedEvidence:true});expect(()=>consumed.assertFresh()).not.toThrow();
 f.setTime(now+5000);expect(()=>consumed.assertFresh()).toThrow('proof_unavailable');expect(()=>f.proof.consume({...proof},plan)).toThrow('proof_unavailable');
});
it('retains private caller freshness after the last awaited source authority callback',async()=>{const f=fixture();let calls=0;(f.ports as any).assertCurrent=async()=>{const n=++calls;return()=>{if(n===2)throw Error('original session expired')}};await expect(f.proof.read(plan,new AbortController().signal)).rejects.toThrow('original session expired')});
