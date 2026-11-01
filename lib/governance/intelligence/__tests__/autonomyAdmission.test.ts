import {expect,it} from 'vitest';
import {GOVERNED_ACTIONS,compileBaseline,parseEvidenceSnapshot} from '../contracts';
import {evaluateGovernanceAdmission} from '../admission';
const now=Date.parse('2026-11-01T12:00:00Z'),scope={repositoryId:'org/repo',resourceId:'github:repository:org/repo',environment:'production' as const},digest='a'.repeat(64);
function fixture(action:typeof GOVERNED_ACTIONS[number],level:number,decision:'allow'|'require_approval'|'block'='allow',requirements:('verified_evidence'|'rollback_verified')[]=[]){
 const evidence=parseEvidenceSnapshot({organizationId:'org',source:'github',connectionId:'connection',connectionRevision:'revision',collectorVersion:'v1',selection:scope,observedAt:new Date(now-1000).toISOString(),expiresAt:new Date(now+60000).toISOString(),completeness:'complete',sourceDigest:digest,facts:[]});
 const baseline=compileBaseline({organizationId:'org',parentDigest:null,scopes:[scope],evidenceDigests:[evidence.digest],rules:[{id:'rule',actions:[action],scope,decision,requirements,evidenceDigests:[evidence.digest]}]});
 return{now,evidence,request:{organizationId:'org',actorUserId:'executor',action,scope,planDigest:digest,providerAccessVerified:true,platformAllowed:true,autonomyLevel:level,verifiedEvidence:true,rollbackVerified:false},active:{baseline,activeDigest:baseline.digest,approvedDigest:baseline.digest,revoked:false},coverage:{enrolled:true,coveredActions:[action]},approval:{organizationId:'org',baselineDigest:baseline.digest,planDigest:digest,requesterUserId:'executor',approverUserId:'reviewer',currentAuthorityVerified:true,expiresAt:new Date(now+60000).toISOString()}};
}
it.each(GOVERNED_ACTIONS)('enforces the numeric ceiling for %s even with exact independent approval',action=>{
 const minimum=action==='discovery.read'?0:action==='recommendation.create'?1:4;
 for(let level=0;level<=5;level++)for(const decision of ['allow','require_approval'] as const){const f=fixture(action,level,decision),result=evaluateGovernanceAdmission(f);expect(result.allowed,`${action} at ${level} with ${decision}`).toBe(level>=minimum);if(level<minimum)expect(result).toMatchObject({decision:'denied',reason:'autonomy_execution_unavailable'});}
});
it('retains exact human approval at execution levels and rejects stale approval',()=>{
 for(const level of [4,5]){const f=fixture('repository.merge',level,'require_approval');expect(evaluateGovernanceAdmission({...f,approval:undefined})).toMatchObject({allowed:false,decision:'requires_approval'});expect(evaluateGovernanceAdmission({...f,approval:{...f.approval,baselineDigest:'b'.repeat(64)}}).allowed).toBe(false);expect(evaluateGovernanceAdmission(f).allowed).toBe(true);}
});
it('does not let numeric execution authority bypass rollback, provider, platform or block policy',()=>{
 for(const level of [4,5]){const f=fixture('repository.merge',level,'allow',['rollback_verified']);expect(evaluateGovernanceAdmission(f)).toMatchObject({allowed:false,reason:'required_safeguard_missing'});expect(evaluateGovernanceAdmission({...f,request:{...f.request,rollbackVerified:true}}).allowed).toBe(true);for(const delta of [{providerAccessVerified:false},{platformAllowed:false}])expect(evaluateGovernanceAdmission({...f,request:{...f.request,rollbackVerified:true,...delta}}).allowed).toBe(false);expect(evaluateGovernanceAdmission(fixture('repository.merge',level,'block'))).toMatchObject({allowed:false,reason:'approved_policy_block'});}
});
