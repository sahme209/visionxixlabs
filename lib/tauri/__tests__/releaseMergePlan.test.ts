import {expect,it} from 'vitest';
import {buildReleaseMergePlan} from '../releaseMergePlan';
import {completeReleaseIntake} from './fixtures/completeReleaseIntake';
import {sha256ContentHash} from '../contentHash';
const intake={...completeReleaseIntake(),repositoryUrls:['https://github.com/team/service'],productionPrUrls:['https://github.com/team/service/pull/42'],sourceBranch:'release/demo',targetBranch:'main'};
const row={id:intake.id,organizationId:intake.tenantId,version:3,status:'submitted',intakeJson:intake};
const observation={connectionId:'github-1',connectionRevision:'2026-10-24T00:00:00Z',repositoryFullName:'team/service',number:42,headRepositoryFullName:'team/service',headRef:'release/demo',headSha:'a'.repeat(40),baseRef:'main',baseSha:'b'.repeat(40),state:'open',draft:false,merged:false};
const input={organizationId:row.organizationId,requestId:row.id,expectedVersion:3,expectedDigest:sha256ContentHash({requestVersion:3,intake}),method:'squash',observation};
it('binds the exact stored release and PR into a detached immutable merge plan, without execution authority',()=>{
 const result=buildReleaseMergePlan(row,input);expect(result.ok).toBe(true);if(!result.ok)return;
 expect(result.plan.kind).toBe('merge_pull_request');expect(result.plan.pullRequest.headSha).toBe(observation.headSha);
 expect(result.digest).toBe(sha256ContentHash(result.plan));expect(Object.isFrozen(result.plan.pullRequest)).toBe(true);
 expect(result.plan).not.toHaveProperty('approved');
 const prior=result.plan.pullRequest.headSha; const mutable={...observation};const second=buildReleaseMergePlan(row,{...input,observation:mutable});mutable.headSha='c'.repeat(40);
 if(second.ok)expect(second.plan.pullRequest.headSha).toBe(prior);
});
it.each([{organizationId:'other'},{requestId:'other'},{expectedVersion:4},{expectedDigest:'c'.repeat(64)},{method:'auto'},{method:'squash',approved:true}])('refuses stale context and unexpected grant fields %j',patch=>{expect(buildReleaseMergePlan(row,{...input,...patch}).ok).toBe(false)});
it.each([{number:43},{repositoryFullName:'other/service'},{headRepositoryFullName:'fork/service'},{headRef:'other'},{baseRef:'other'},{headSha:'bad'},{state:'closed'},{draft:true},{merged:true},{connectionRevision:'yesterday'}])('refuses a different or ineligible provider target %j',patch=>{expect(buildReleaseMergePlan(row,{...input,observation:{...observation,...patch}}).ok).toBe(false)});
it('binds merge method and head changes into different digests',()=>{
 const a=buildReleaseMergePlan(row,input),b=buildReleaseMergePlan(row,{...input,method:'merge'}),c=buildReleaseMergePlan(row,{...input,observation:{...observation,headSha:'c'.repeat(40)}});
 expect(a.ok&&b.ok&&c.ok).toBe(true);if(a.ok&&b.ok&&c.ok){expect(a.digest).not.toBe(b.digest);expect(a.digest).not.toBe(c.digest)}
});
it('refuses drafts, no-PR declarations, and incomplete intake',()=>{
 for(const changed of [{...row,status:'draft'},{...row,intakeJson:{...intake,noPrRequired:true}},{...row,intakeJson:{...intake,validationSteps:[]}}]){
  expect(buildReleaseMergePlan(changed,{...input,expectedDigest:sha256ContentHash({requestVersion:3,intake:changed.intakeJson})}).ok).toBe(false);
 }
});
