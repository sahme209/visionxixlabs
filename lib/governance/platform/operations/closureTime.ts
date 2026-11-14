import {assertExecutionWindow,type ExecutionTimeSource,type ExecutionTimeWindow} from '../executionTime';
import {readOperationalTimeObservation} from '../nativeTime/operationalSource';
import type {CustodianClosureEvidence} from './custodianClosureObservation';
const fail=():never=>{throw Error('custodian_closure_time_unavailable')};
/** Supplements original authenticated custody/source qualification; serialized
 * closure metadata never authenticates the time supplier or discharges itself. */
export async function assertClosureEvidenceTime(clock:ExecutionTimeSource,evidence:CustodianClosureEvidence,restriction:ExecutionTimeWindow,signal:AbortSignal){
 const before=restriction.notBefore??0,expiry=Math.min(restriction.expiresAt??Number.MAX_SAFE_INTEGER,evidence.expiresAt);
 if(evidence.format===1){
  const observation=await assertExecutionWindow(clock,{notBefore:Math.max(before,evidence.credentialNotAfter+1),expiresAt:expiry},signal);
  if('assurance' in observation)return fail();return;
 }
 const observation=await assertExecutionWindow(clock,{notBefore:before,expiresAt:expiry},signal),o=readOperationalTimeObservation(observation),expected=evidence.operationalTime;
 if(!o||o.profileDigest!==expected.profileDigest||o.revision!==expected.revision||o.hostGeneration!==expected.hostGeneration||o.sourceGeneration!==expected.sourceGeneration||o.unixTimeNs<=BigInt(evidence.credentialNotAfter)*BigInt(1000000))return fail();
}
