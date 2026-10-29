/** Fixed classifications only. Never accepts or emits provider-controlled text. */
export type GcpGuidedFailurePhase='exchange'|'token_validation'|'projects_read'|'authority'|'credential_store'|'resource_verify';
export type GcpGuidedFailureReason='unconfirmed'|'http_refused'|'invalid_grant'|'invalid_client'|'service_disabled'|'permission_denied'|'invalid_shape'|'scope_unverified';
export interface GcpGuidedDiagnostic {phase:GcpGuidedFailurePhase;reason:GcpGuidedFailureReason;httpStatus?:number}
const phases=new Set<GcpGuidedFailurePhase>(['exchange','token_validation','projects_read','authority','credential_store','resource_verify']);
const reasons=new Set<GcpGuidedFailureReason>(['unconfirmed','http_refused','invalid_grant','invalid_client','service_disabled','permission_denied','invalid_shape','scope_unverified']);
export class GcpGuidedProviderFailure extends Error {constructor(public diagnostic:GcpGuidedDiagnostic){super('gcp_guided_provider_failure')}}
export function safeGcpGuidedDiagnostic(error:unknown,fallback:GcpGuidedFailurePhase):GcpGuidedDiagnostic {if(error instanceof GcpGuidedProviderFailure&&phases.has(error.diagnostic.phase)&&reasons.has(error.diagnostic.reason)){const {phase,reason,httpStatus}=error.diagnostic;return{phase,reason,...(Number.isInteger(httpStatus)&&httpStatus!>=100&&httpStatus!<=599?{httpStatus}:{})}}return{phase:phases.has(fallback)?fallback:'authority',reason:'unconfirmed'}}
