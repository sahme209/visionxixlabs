import {expect,it} from 'vitest';
import {compileDeploymentRecoveryPlan,readDeploymentRecoveryPlan,compileDeploymentRecoveryPlatformPlan,validateDeploymentRecoveryEvidence} from '../deploymentRecoveryContract';
import {reserveDeploymentTarget,createDeploymentRequestReceipt,observeDeploymentRequest} from '../deploymentLiability';
import type {PlatformEffect} from '../contracts';
const a='a'.repeat(64),b='b'.repeat(64),id='platform_action_11111111-1111-4111-8111-111111111111';
const effect:PlatformEffect={id:'deploy',kind:'deployment.vercel',target:{teamId:'team',projectName:'project',environment:'production',projectCreation:'may_create_named_project',filesDigest:a,configurationDigest:b}};
function fixture(){
 const reserved=reserveDeploymentTarget(effect,id,0,a,b,1000,null),receipt=createDeploymentRequestReceipt({format:1,purpose:'platform_deployment_request_receipt_v1',receiptId:'platform_deployment_receipt_11111111-1111-4111-8111-111111111111',nativeKey:reserved.nativeKey,generation:1,actionId:id,effectIndex:0,planDigest:a,sourceDigest:b,providerDeploymentId:'dpl_fixture',providerState:'BUILDING',outcome:'accepted',observedAt:1100,ready:false}),reservation=observeDeploymentRequest(reserved,receipt,1200);
 const plan=compileDeploymentRecoveryPlan({reservation,receipt,profileDigest:b,expiresAt:new Date(5000).toISOString()});
 const evidence={format:1,purpose:'platform_deployment_terminal_observation_v1',observationId:'platform_evidence_22222222-2222-4222-8222-222222222222',nativeKey:reservation.nativeKey,generation:1,actionId:id,requestReceiptDigest:receipt.receiptDigest,providerDeploymentId:'dpl_fixture',profileDigest:b,kind:'terminal_safe_to_release',observedAt:1400,expiresAt:4000};
 return {reservation,receipt,plan,evidence};
}
it('binds immutable exact original receipt, target generation/version and profile without granting authority',()=>{
 const {plan}=fixture(),action=compileDeploymentRecoveryPlatformPlan(plan);
 expect(plan).toMatchObject({authority:'metadata_only',executionAuthorized:false,expectedReservationVersion:1,generation:1,originalActionId:id});
 expect(action.effects).toHaveLength(1);expect(action.effects[0]).toMatchObject({kind:'deployment.target.release',target:{recoveryDigest:plan.digest,nativeKey:plan.nativeKey,generation:1}});
 expect(readDeploymentRecoveryPlan(plan)).toEqual(plan);expect(Object.isFrozen(plan.target)).toBe(true);
});
it.each([{generation:2},{expectedReservationVersion:2},{profileDigest:a},{providerDeploymentId:'dpl_other'},{authority:'approved'},{executionAuthorized:true},{url:'https://untrusted.invalid'}])('refuses tampered stored metadata %j',change=>{expect(()=>readDeploymentRecoveryPlan({...fixture().plan,...change})).toThrow()});
it('accepts only exact fresh evidence and preserves original immutable request',()=>{
 const {plan,reservation,receipt,evidence}=fixture(),before=JSON.stringify(receipt);
 expect(validateDeploymentRecoveryEvidence(plan,reservation,receipt,evidence,1500)).toMatchObject({phase:'released',generation:1,version:2});expect(JSON.stringify(receipt)).toBe(before);
});
it.each([{profileDigest:a},{generation:2},{providerDeploymentId:'dpl_other'},{observedAt:900},{observedAt:1600},{expiresAt:1500},{kind:'BUILDING'}])('refuses mismatched or stale native evidence %j',change=>{const f=fixture();expect(()=>validateDeploymentRecoveryEvidence(f.plan,f.reservation,f.receipt,{...f.evidence,...change},1500)).toThrow()});
it('refuses changed target versions, released state and expired reviewed plans',()=>{const f=fixture();expect(()=>validateDeploymentRecoveryEvidence(f.plan,{...f.reservation,version:2},f.receipt,f.evidence,1500)).toThrow();expect(()=>validateDeploymentRecoveryEvidence(f.plan,f.reservation,f.receipt,f.evidence,5000)).toThrow();const released=validateDeploymentRecoveryEvidence(f.plan,f.reservation,f.receipt,f.evidence,1500);expect(()=>compileDeploymentRecoveryPlan({reservation:released,receipt:f.receipt,profileDigest:b,expiresAt:new Date(5000).toISOString()})).toThrow()});
it('cannot prepare unknown or reference-less requests, or a deadline preceding their observation',()=>{const f=fixture(),{receiptDigest:_,...fields}=f.receipt,unknown=createDeploymentRequestReceipt({...fields,outcome:'unknown',providerDeploymentId:null,providerState:null}),held={...f.reservation,requestReceiptDigest:unknown.receiptDigest};expect(()=>compileDeploymentRecoveryPlan({reservation:held,receipt:unknown,profileDigest:b,expiresAt:new Date(5000).toISOString()})).toThrow();expect(()=>compileDeploymentRecoveryPlan({reservation:f.reservation,receipt:f.receipt,profileDigest:b,expiresAt:new Date(1100).toISOString()})).toThrow()});
