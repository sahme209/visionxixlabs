import {evaluateGovernancePolicy,type AdmissionInput} from './admissionPolicy';
export type {AdmissionInput} from './admissionPolicy';
/** Execution still requires real provider access; claim eligibility is a distinct scheme. */
export function evaluateGovernanceAdmission(input:AdmissionInput){const result=evaluateGovernancePolicy(input,'execution'),decision=result.decision==='satisfied'?'allowed':result.decision;return{decision,allowed:decision==='allowed',reason:result.reason,matchedRuleIds:result.matchedRuleIds};}
