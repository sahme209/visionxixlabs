import {describe,it,expect} from 'vitest';
import {compilePlatformPlan,createPlatformAction,approvePlatformAction,claimPlatformAction,finishPlatformAction} from '../kernel';
const d='a'.repeat(64),requester={userId:'requester',sessionId:'requester-session'},reviewer={userId:'reviewer',sessionId:'reviewer-session'};
const at=Date.parse('2026-11-12T00:00:00Z');
const raw=()=>({format:1,scope:'platform',sourceDigest:d,expiresAt:new Date(at+60000).toISOString(),effects:[{id:'deploy',kind:'deployment.vercel',target:{projectId:'project',environment:'production',filesDigest:d,configurationDigest:d}}]});
function approved(){return approvePlatformAction(createPlatformAction(compilePlatformPlan(raw()),requester,at),{...reviewer,planDigest:compilePlatformPlan(raw()).digest},at)}
describe('exact platform plans and lifecycle',()=>{
 it('binds immutable source, exact target/effect, expiry and plan digest',()=>{
  const plan=compilePlatformPlan(raw());expect(plan.digest).toMatch(/^[a-f0-9]{64}$/);expect(Object.isFrozen(plan.effects[0].target)).toBe(true);
  expect(compilePlatformPlan({...raw(),effects:[{...raw().effects[0],target:{...raw().effects[0].target,projectId:'other'}}]}).digest).not.toBe(plan.digest);
 });
 it('refuses workspace identity, approval flags and incomplete targets',()=>{
  for(const bad of [{...raw(),organizationId:'fake-tenant'},{...raw(),approved:true},{...raw(),scope:'workspace'},{...raw(),effects:[{id:'deploy',kind:'deployment.vercel',target:{projectId:'project'}}]}])expect(()=>compilePlatformPlan(bad)).toThrow();
 });
 it('has distinct typed bindings for every known effect, without content or credentials',()=>{
  const connection={connectionId:'connection',connectionRevision:'revision',author:'author'};
  const effects=[
   {id:'ecs',kind:'deployment.ecs',target:{accountId:'123456789012',region:'us-east-1',cluster:'cluster',service:'service',taskDefinitionArn:'arn:aws:ecs:us-east-1:123456789012:task-definition/task:1',operation:'force',configurationDigest:d}},
   {id:'settings',kind:'settings.vercel',target:{projectId:'project',settingsDigest:d}},
   {id:'bucket',kind:'template.bucket.create',target:{accountId:'123456789012',region:'us-east-1',bucket:'bucket'}},
   {id:'object',kind:'template.object.put',target:{accountId:'123456789012',region:'us-east-1',bucket:'bucket',key:'key',bytesDigest:d}},
   {id:'access',kind:'template.access.grant',target:{accountId:'123456789012',region:'us-east-1',bucket:'bucket',key:'key',objectVersion:'v1',bytesDigest:d,recipientDigest:d,ttlSeconds:3600}},
   {id:'initialize',kind:'growth.image.initialize',target:{...connection,bytesDigest:d}},
   {id:'put',kind:'growth.image.put',target:{...connection,bytesDigest:d,uploadGrantDigest:d,destinationOrigin:'https://uploads.example.test',destinationPathDigest:d}},
   {id:'post',kind:'growth.post.publish',target:{...connection,draftId:'draft',renderedPayloadDigest:d}},
   {id:'delete',kind:'growth.post.delete',target:{...connection,postUrn:'urn:li:share:1'}},
   {id:'schedule',kind:'growth.schedule.change',target:{...connection,draftId:'draft',scheduledFor:new Date(at+1000).toISOString(),renderedPayloadDigest:d}},
  ];
  expect(compilePlatformPlan({...raw(),effects}).effects).toHaveLength(10);
  expect(()=>compilePlatformPlan({...raw(),effects:[{...effects[6],target:{...effects[6].target,destinationOrigin:'https://user:password@example.test'}}]})).toThrow();
  expect(()=>compilePlatformPlan({...raw(),effects:[{...effects[7],target:{...effects[7].target,accessToken:'secret'}}]})).toThrow();
 });
 it('refuses duplicate effect identity and oversized effect batches',()=>{
  expect(()=>compilePlatformPlan({...raw(),effects:[raw().effects[0],raw().effects[0]]})).toThrow();
  expect(()=>compilePlatformPlan({...raw(),effects:Array.from({length:33},(_,i)=>({...raw().effects[0],id:'effect'+i}))})).toThrow();
 });
 it('requires exact independent review, not requester or a changed digest',()=>{
  const state=createPlatformAction(compilePlatformPlan(raw()),requester,at);
  for(const r of [{...requester,planDigest:state.plan.digest},{...reviewer,planDigest:'b'.repeat(64)}])expect(()=>approvePlatformAction(state,r,at)).toThrow();
  expect(approvePlatformAction(state,{...reviewer,planDigest:state.plan.digest},at).status).toBe('approved');
 });
 it('allows only the original exact requester session to claim once',()=>{
  const state=approved();for(const actor of [reviewer,{...requester,sessionId:'other-session'}])expect(()=>claimPlatformAction(state,actor,at)).toThrow();
  const claimed=claimPlatformAction(state,requester,at);expect(claimed.attemptCount).toBe(1);expect(claimed.status).toBe('claimed');
  expect(()=>claimPlatformAction(claimed,requester,at)).toThrow();
 });
 it('refuses expired, backwards or nonfinite clocks and invalid principals',()=>{
  expect(()=>createPlatformAction(compilePlatformPlan(raw()),{...requester,userId:''},at)).toThrow();
  for(const clock of [at+60000,at-1,NaN,Infinity])expect(()=>claimPlatformAction(approved(),requester,clock)).toThrow();
 });
 it('keeps confirmed/refused/unknown outcomes terminal and immutable',()=>{
  for(const outcome of ['confirmed','refused','unknown'] as const){
   const done=finishPlatformAction(claimPlatformAction(approved(),requester,at),outcome,at+1);
   expect(done.status).toBe(outcome);expect(done.attemptCount).toBe(1);expect(Object.isFrozen(done)).toBe(true);
   expect(()=>claimPlatformAction(done,requester,at+2)).toThrow();expect(()=>finishPlatformAction(done,'confirmed',at+2)).toThrow();
  }
 });
 it('rejects forged compiled-plan digest and malformed lifecycle state',()=>{
  const plan=compilePlatformPlan(raw());expect(()=>createPlatformAction({...plan,digest:'b'.repeat(64)},requester,at)).toThrow();
  expect(()=>claimPlatformAction({...approved(),attemptCount:1},requester,at)).toThrow();
  expect(()=>claimPlatformAction({...approved(),reviewer:requester},requester,at)).toThrow();
 });
});
