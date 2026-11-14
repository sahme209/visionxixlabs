import 'server-only';
import type {ExecutionTimeSource} from '../executionTime';
import {createOperationalExecutionTimeSource} from './operationalSource';
import {createOperationalNativeBridge,type PrivateOperationalInitializer} from './operationalNativePorts';
import {createOperationalProviderExpiryClosureSource,type OperationalClosureNativeBridge} from '../operations/operationalClosureSource';
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
function composeLinuxTime(source:ExecutionTimeSource,ports:Omit<PrivateLinuxTimeCompositionPorts,'time'>){
 const q=ports.custodian,custodian=createNativeCustodianPorts({clock:source,assertQualified:q.assertQualified.bind(q),assertSourceLeaseCurrent:q.assertSourceLeaseCurrent.bind(q),capture:q.capture.bind(q),assertCurrent:q.assertCurrent.bind(q),...(q.assertCurrentFacts?{assertCurrentFacts:q.assertCurrentFacts.bind(q)}:{})}),clock=custodian.clock,
  identity=createOperationalWorkloadIdentity(ports.identitySource,clock,ports.runtimeSignal),
  transport=createOperationalEcsSdkTransport(ports.ecsQualification,clock,ports.ecsDispatchCurrent),
  runner=createOperationalWorkloadRunner({...ports.workload,identity,custodian,transport});
 return Object.freeze({clock,custodian,identity,transport,runner,http:createOperationalWorkloadHttp(runner)});
}

export function createPrivateLinuxTimeComposition(ports:PrivateLinuxTimeCompositionPorts){return composeLinuxTime(createNativeExecutionTimeSource(ports.time),ports)}
export interface PrivateLinuxOperationalTimeCompositionPorts extends Omit<PrivateLinuxTimeCompositionPorts,'time'>{
 /** Original output of the fixed C module initializer; NEVER request JSON or a
  * generic native/healthy flag. No default loader or registration exists. */
 nativeInitializer:PrivateOperationalInitializer;
 closureNative?:OperationalClosureNativeBridge;
}
/** Actual operational source→custodian→JWT→STS/ECS composition. Native inputs
 * still require real bootstrap/custody/runtime qualification; the current
 * role-free runtime filter cannot send provider traffic and is NOT such a
 * production profile. Mocked HTTP tests do not qualify it. */
export function createPrivateLinuxOperationalTimeComposition(ports:PrivateLinuxOperationalTimeCompositionPorts){
 const bridge=createOperationalNativeBridge(ports.nativeInitializer),clock=createOperationalExecutionTimeSource(bridge),joined=composeLinuxTime(clock,ports);
 const closure=ports.closureNative?createOperationalProviderExpiryClosureSource(joined.clock,{source:{readObservedProviderExpiry:lease=>joined.custodian.readObservedProviderExpiry?.(lease)??null},derived:joined.runner},ports.closureNative,ports.runtimeSignal):undefined;
 return Object.freeze({...joined,closure});
}
