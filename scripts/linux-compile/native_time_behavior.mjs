// Fixed trusted native behavior fixture. Not an admitted time source.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const pause=()=>new Promise(resolve=>setTimeout(resolve,1));
const rejects=async f=>{let refused=false;try{await f()}catch{refused=true}assert.equal(refused,true)};
const closed=f=>{assert.equal(f.close_attempts,1n);assert.equal(f.close_result,0n);assert.equal(f.close_operation_refs,0n);assert.equal(f.closed,1n);assert.equal(f.close_unknown,0n)};
let phase='joined',reason='version';
try{
 assert.equal(process.versions.node,'24.22.2');
 reason='module';const fixture=require('./fixture.node').runOwnedFixture();
 reason='hold';const p=fixture.success,h=await p.hold();
 const original={bytes:new Uint8Array(h.bytes),device:h.device,inode:h.inode,publication:h.publication,marker:h.disruptionMarker};
 reason='start';await p.assertResourceCurrent(h);const w=p.start(h);void w.completed.catch(()=>{});reason='capture';const c=await w.result;await w.completed;reason='evidence';
 assert.equal(c.identity,h);assert.deepEqual(c.bytes,original.bytes);assert.equal(c.device,original.device);assert.equal(c.inode,original.inode);assert.equal(c.publication,original.publication);assert.equal(c.disruptionMarker,original.marker);
 for(const key of ['realtimeNs','p0Ns','p1Ns','p2Ns'])assert.equal(typeof c[key],'bigint');
 assert(c.p0Ns<=c.p1Ns&&c.p1Ns<=c.p2Ns);const before={r:c.realtimeNs,p0:c.p0Ns,p1:c.p1Ns,p2:c.p2Ns};
 const final=await p.observeResourceCurrent(h,c);assert(final.p2>=before.p2);assert.equal(c.realtimeNs,before.r);assert.equal(c.p0Ns,before.p0);assert.equal(c.p1Ns,before.p1);
 reason='release';await w.terminate();await w.terminate();await p.release(h);closed(fixture.factsSuccess());const success=fixture.factsSuccess();assert.equal(success.owned_reap,1n);assert.equal(success.reap_code,success.expectedExited);assert.equal(success.reap_status,0n);
 phase='replacement';reason='hold';const r=fixture.replacement,rh=await r.hold();reason='replace';fixture.replaceCurrent();reason='refusal';await rejects(()=>r.assertResourceCurrent(rh));
 let replacementWorker;try{replacementWorker=r.start(rh)}catch{/* A synchronous pre-launch refusal owns no worker. */}
 if(replacementWorker){void replacementWorker.completed.catch(()=>{});await rejects(()=>replacementWorker.result);assert.equal(fixture.factsReplacement().owned_reap,1n);await replacementWorker.completed;await replacementWorker.terminate()}
 reason='release';await r.release(rh);closed(fixture.factsReplacement());
 phase='cancellation';reason='hold';const k=fixture.cancel,kh=await k.hold();reason='start';const kw=k.start(kh);void kw.completed.catch(()=>{});const cancelled=kw.result.then(()=>false,()=>true);
 reason='ready';const readyBy=performance.now()+150;while(!fixture.cancelReady()){assert(performance.now()<readyBy);await pause()}
 reason='cancel';await kw.terminate();await kw.completed;reason='evidence';assert.equal(await cancelled,true);await kw.terminate();const cancellation=fixture.factsCancel();assert.equal(cancellation.owned_reap,1n);assert.equal(cancellation.reap_code,cancellation.expectedKilled);assert.equal(cancellation.reap_status,cancellation.expectedKillSignal);assert(cancellation.cancel_at>0n&&cancellation.cancel_at<cancellation.deadline);reason='release';await k.release(kh);closed(fixture.factsCancel());
 phase='foreign';reason='hold';const f=fixture.foreign,fh=await f.hold();reason='refusal';for(const foreign of [{},fh]){await rejects(()=>p.start(foreign));await rejects(()=>p.release(foreign));await rejects(()=>p.observeResourceCurrent(foreign,c))}reason='release';await f.release(fh);closed(fixture.factsForeign());
 phase='cleanup';reason='cleanup';for(const bridge of [p,r,k,f])bridge.retire();fixture.cleanup();
 console.log(JSON.stringify({format:'axiom-native-time-behavior-v1',cases:['joined','replacement','cancellation','foreign'],accepted:true,timeAuthority:false}));
}catch{console.log(JSON.stringify({format:'axiom-native-time-behavior-v1',accepted:false,error:'fixture_failed',phase,reason,timeAuthority:false}));process.exitCode=1}
