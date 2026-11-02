import {evaluateGovernancePolicy,type AdmissionInput} from './admissionPolicy';
/** Eligibility may admit a durable release claim, never credential issuance or provider execution. */
export function evaluateGovernanceClaimEligibility(input:AdmissionInput){const result=evaluateGovernancePolicy(input,'release_claim'),decision=result.decision==='satisfied'?'claim_allowed':result.decision;return{decision,claimAllowed:decision==='claim_allowed',reason:result.reason,matchedRuleIds:result.matchedRuleIds};}
