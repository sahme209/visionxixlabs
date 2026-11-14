// Actual private publication resource observation; no interval/policy authority.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
let phase='initialize',held,worker,bridge;
try{
 assert.equal(process.versions.node,'24.22.2');
 bridge=require('./host_reader.node').openHostEvaluation();
 phase='hold';held=await bridge.hold();
 const bytes=new Uint8Array(held.bytes);
 assert.equal(held.sourceGeneration,'host-evaluation-1');
 phase='current';await bridge.assertResourceCurrent(held);
 phase='worker';worker=bridge.start(held);void worker.completed.catch(()=>{});
 const capture=await worker.result;await worker.completed;await worker.terminate();
 assert.equal(capture.identity,held);assert.deepEqual(capture.bytes,bytes);
 assert.equal(capture.publication,held.publication);assert.equal(capture.disruptionMarker,held.disruptionMarker);
 const before={r:capture.realtimeNs,p0:capture.p0Ns,p1:capture.p1Ns,p2:capture.p2Ns};
 phase='observation';const final=await bridge.observeResourceCurrent(held,capture);
 assert(before.p0<=before.p1&&before.p1<=before.p2&&before.p2<=final.p2);
 assert.equal(capture.realtimeNs,before.r);assert.equal(capture.p0Ns,before.p0);assert.equal(capture.p1Ns,before.p1);
 phase='release';await bridge.release(held);held=undefined;bridge.retire();
 console.log(JSON.stringify({format:1,event:'reader_complete',strictTimeAuthority:false,sourceGeneration:'host-evaluation-1',publication:capture.publication.toString(),disruptionMarker:capture.disruptionMarker.toString(),device:capture.device.toString(),inode:capture.inode.toString(),realtimeNs:before.r.toString(),p0Ns:before.p0.toString(),p1Ns:before.p1.toString(),p2Ns:final.p2.toString()}));
}catch{
 let cleanupKnown=true;
 try{if(worker){await worker.terminate();await worker.completed}}catch{cleanupKnown=false}
 try{if(held)await bridge.release(held)}catch{cleanupKnown=false}
 try{bridge?.retire()}catch{cleanupKnown=false}
 console.log(JSON.stringify({format:1,event:'reader_refused',phase,cleanupKnown,strictTimeAuthority:false}));
 process.exitCode=1;
}
