import {it,expect} from 'vitest';
import {readOperationalStabilityHistory} from '../stabilityHistory';
import {preview,id,d} from '../../../../desktop/__tests__/fixtures/operationalReview';
import {compileOperationalEcsPlan} from '../ecsPreparation';
import {createPlatformAction,approvePlatformAction,claimPlatformAction,finishPlatformAction} from '../../kernel';
import {createOperationalEcsResult} from '../ecsExecution';
import {nativeEcsTargetKey} from '../reservationContract';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
function fixture(){
 const requester={userId:'requester',sessionId:'s1'},reviewer={userId:'reviewer',sessionId:'s2'},plan=compileOperationalEcsPlan(preview.manifest),parent=finishPlatformAction(claimPlatformAction(approvePlatformAction(createPlatformAction(plan,requester,1),{...reviewer,planDigest:plan.digest},2),requester,3),'confirmed',100);
 const result=createOperationalEcsResult({format:1,purpose:'operational_ecs_update_result_v1',actionId:id,manifestDigest:preview.manifest.digest,nativeKey:nativeEcsTargetKey(preview.manifest.target),generation:1,leaseRef:'platform_credential_22222222-2222-4222-8222-222222222222',kind:'accepted',deploymentId:'ecs-svc/2',requestId:'synthetic',observedAt:10,stable:false,rollbackAuthorized:false});
 const receiptId='platform_evidence_22222222-2222-4222-8222-222222222222',detail={receiptId,actionId:id,manifestDigest:result.manifestDigest,target:preview.manifest.target,generation:1,kind:'stable',deploymentId:result.deploymentId,observedAt:new Date(50).toISOString(),profileDigest:d},fields={receiptId,nativeKey:result.nativeKey,generation:1,actionId:id,manifestDigest:result.manifestDigest,kind:'stable',previousCredentialClosureReceiptId:null,detail},native={...fields,receiptDigest:sha256ContentHash(fields)};
 const event={operationalObserverUserId:'observer',operationalStabilityReceiptId:receiptId,operationalCommandReceiptDigest:result.receiptDigest,planDigest:plan.digest,stateDigest:sha256ContentHash(parent),status:'confirmed',attemptCount:1};
 return {parent,result,native,event};
}
it('projects only the immutable original stability proof without claiming current health or execution',()=>{const f=fixture();expect(readOperationalStabilityHistory(id,f.parent,f.result,f.event,f.native)).toMatchObject({receiptId:f.native.receiptId,deploymentId:'ecs-svc/2',observerUserId:'observer',observedAt:new Date(50).toISOString(),authority:'historical_stability_only',currentHealthChecked:false,executionAuthorized:false});expect(f.result.stable).toBe(false)});
it('rejects altered event, original command, receipt lineage and impossible observation times',()=>{const f=fixture();for(const event of [{...f.event,operationalCommandReceiptDigest:d},{...f.event,stateDigest:d},{...f.event,operationalStabilityReceiptId:'platform_evidence_33333333-3333-4333-8333-333333333333'}])expect(()=>readOperationalStabilityHistory(id,f.parent,f.result,event,f.native)).toThrow();for(const detail of [{...f.native.detail,generation:2},{...f.native.detail,deploymentId:'ecs-svc/3'},{...f.native.detail,observedAt:new Date(5).toISOString()},{...f.native.detail,observedAt:new Date(101).toISOString()}]){const {receiptDigest:ignored,...fields}=f.native,changed={...fields,detail};expect(()=>readOperationalStabilityHistory(id,f.parent,f.result,f.event,{...changed,receiptDigest:sha256ContentHash(changed)})).toThrow()}});
