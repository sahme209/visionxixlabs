/** Fixed installed supplier checkpoint. Package materialization must compile this
 * entry and its closed imports; importing it intentionally runs one observation.
 * No route/default, provider/custodian qualifier or caller-selected loader. */
import {createRequire} from 'node:module';
import process from 'node:process';
import {createOperationalNativeBridge,type PrivateOperationalInitializer} from './operationalNativePorts';
import {createOperationalExecutionTimeSource} from './operationalSource';

const retainedInitializers=new Set<PrivateOperationalInitializer>();
export const completion=(async()=>{
 const stop=new AbortController();
 const abort=()=>stop.abort();
 const signals=['SIGINT','SIGTERM','SIGHUP'] as const;
 for(const signal of signals)process.once(signal,abort);
 let initializer:PrivateOperationalInitializer|undefined;
 let bridge:ReturnType<typeof createOperationalNativeBridge>|undefined;
 let observed=false;
 try{
  if(process.argv.length!==2||process.argv[1]!=='/opt/axiom-operational-time/private/main.mjs'||process.versions.node!=='24.22.2')throw Error('fixed_package_required');
  // Module init consumes the original administrative descriptors. This is not
  // the evaluation addon's openHostEvaluation() or an injectable JS factory.
  initializer=createRequire(import.meta.url)('/opt/axiom-operational-time/private/operational.node') as PrivateOperationalInitializer;
  retainedInitializers.add(initializer);
  stop.signal.throwIfAborted();
  bridge=createOperationalNativeBridge(initializer);
  const clock=createOperationalExecutionTimeSource(bridge);
  await clock(stop.signal);
  stop.signal.throwIfAborted();
  observed=true;
 }catch{
  process.exitCode=70;
 }finally{
  // Keep initializer strongly held through receipt completion: native retire
  // does not attest parent shutdown; finalization/EOF lets owner kill Node.
  try{if(bridge)bridge.retire();else initializer?.retire()}catch{observed=false;process.exitCode=70}
 }
 try{
  const receipt=JSON.stringify({format:1,event:observed?'operational_supplier_observed':'operational_supplier_refused',qualified:false,governanceEnabled:false,administrativeResult:'unqualified',cleanup:'not_attested'})+'\n';
  // One fixed small receipt, one write, no retry. Callback is stream completion,
  // not durable export, parent acknowledgement or process-cleanup acceptance.
  await new Promise<void>((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('receipt_unconfirmed')),100);
   try{process.stdout.write(receipt,error=>{clearTimeout(timer);if(error)reject(Error('receipt_unconfirmed'));else resolve()})}
   catch{clearTimeout(timer);reject(Error('receipt_unconfirmed'))}
  });
 }catch{process.exitCode=70}
 finally{
  for(const signal of signals)process.removeListener(signal,abort);
  // Retain the original native owner across the asynchronous stdout callback.
  // Do not force exit: late native cleanup still owns its original handles.
  if(initializer)retainedInitializers.delete(initializer);
 }
})();
