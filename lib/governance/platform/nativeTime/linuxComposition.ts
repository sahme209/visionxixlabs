import 'server-only';
import {createNativeExecutionTimeSource,type NativeTimeSourcePorts} from './source';
import {createNativeCustodianPorts,type NativeCustodianQualification} from '../operations/nativeCustodianSupplier';
import {createOperationalWorkloadRunner} from '../operations/workloadRunner';
import {createOperationalWorkloadIdentity} from '../operations/workloadIdentity';
import {createOperationalEcsSdkTransport} from '../operations/ecsSdkTransport';
import {createOperationalWorkloadHttp} from '../operations/workloadHttp';
type RunnerPorts=Parameters<typeof createOperationalWorkloadRunner>[0];
export interface PrivateLinuxTimeCompositionPorts{
 time:NativeTimeSourcePorts;
 custodian:Omit<NativeCustodianQualification,'clock'>;
 workload:Omit<RunnerPorts,'custodian'|'transport'|'identity'>;
 identitySource:Parameters<typeof createOperationalWorkloadIdentity>[0];
 runtimeSignal:AbortSignal;
 ecsQualification:Parameters<typeof createOperationalEcsSdkTransport>[0];
 ecsDispatchCurrent:NonNullable<Parameters<typeof createOperationalEcsSdkTransport>[2]>;
}
/** Dormant private initializer composition only. Required resource contracts
 * belong to an externally qualified native profile; structural objects or no-op
 * fact callbacks do not establish one. No actual initializer, native launcher,
 * route registration, profile issuer or production default is installed. */
export function createPrivateLinuxTimeComposition(ports:PrivateLinuxTimeCompositionPorts){
 const q=ports.custodian,source=createNativeExecutionTimeSource(ports.time),custodian=createNativeCustodianPorts({clock:source,assertQualified:q.assertQualified.bind(q),assertSourceLeaseCurrent:q.assertSourceLeaseCurrent.bind(q),capture:q.capture.bind(q),assertCurrent:q.assertCurrent.bind(q),...(q.assertCurrentFacts?{assertCurrentFacts:q.assertCurrentFacts.bind(q)}:{})}),clock=custodian.clock,
  identity=createOperationalWorkloadIdentity(ports.identitySource,clock,ports.runtimeSignal),
  transport=createOperationalEcsSdkTransport(ports.ecsQualification,clock,ports.ecsDispatchCurrent),
  runner=createOperationalWorkloadRunner({...ports.workload,identity,custodian,transport});
 return Object.freeze({clock,custodian,identity,transport,runner,http:createOperationalWorkloadHttp(runner)});
}
