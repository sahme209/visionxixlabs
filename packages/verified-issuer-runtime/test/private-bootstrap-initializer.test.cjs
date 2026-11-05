'use strict';
// Pure initializer tests: synthetic bytes and mocked effects. Never native/main.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.resolve(__dirname, '../../../lib/desktop/privateReleaseMergeBootstrap.ts'), 'utf8');
function load(failGraph = false, current = true, deferred = false) {
  const events = [];
  let live = current;
  let finish;
  const disposal = new AbortController();
  const exports = {};
  const client = { $disconnect: async () => { events.push('disconnect'); } };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, Buffer, Uint8Array, Object, Reflect, Error, Promise, Date, AbortController, AbortSignal: deferred ? {any: AbortSignal.any.bind(AbortSignal), timeout: () => disposal.signal} : AbortSignal, fetch: () => { throw Error('no transport allowed'); }, require(name) {
    if (name === 'server-only') return {};
    if (name === '@axiom/verified-issuer-runtime') return {readIssuerIdentity: () => ({status:live?'current':'unavailable'})};
    if (name.endsWith('privateReleaseMergeRequestData')) return {createPrivateReleaseMergeDataDispatcher: handlers => async (bytes,signal) => {signal.throwIfAborted();events.push('dispatch');if(deferred)return Promise.race([handlers.execution(),new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error('cancel')),{once:true}))]);return {status:200,body:bytes};}};
    if (name.endsWith('/privateAuthorityDatabase')) return { createPrivateAuthorityDatabase: value => { events.push('database'); assert.equal(value, 'postgresql://synthetic.invalid/example'); return client; } };
    if (name.endsWith('/privateCredentialVault')) return { createPrivateCredentialVault: value => { events.push('vault'); assert.equal(value.length, 32); return {}; } };
    if (name.endsWith('privateReleaseMergeComposition')) return { createPrivateReleaseMergeComposition: resources => { events.push('composition'); assert.equal(resources.client, client); assert.equal(resources.enabled(), true); assert.equal(resources.governanceEnabled(), true); assert.equal(resources.billing.kind, 'legacy'); if (failGraph) throw Error('mock construction failure'); return Object.freeze({ forRequest() { throw Error('unmounted'); }, handleExecution() {events.push('handler');return new Promise(resolve=>{finish=()=>resolve({status:200,body:new Uint8Array()})});}, handleOperation() {throw Error('unused')} }); } };
    throw Error('unexpected import');
  } });
  return { initialize: exports.initializePrivateReleaseMergeBootstrap, events, revoke:()=>{live=false}, finish:()=>finish(), expireDisposal:()=>disposal.abort() };
}
function material() { return Object.freeze({ datasource: 'postgresql://synthetic.invalid/example', vaultKey: new Uint8Array(32).fill(3), sessionSigningKey: new Uint8Array(32).fill(4) }); }
test('actual initializer constructs fixed graph, wipes staging and exposes idempotent cleanup only', async () => {
  const { initialize, events } = load(); const input = material(); const lifetime = await initialize(input);
  assert.deepEqual(events, ['database', 'vault', 'composition']);
  assert.deepEqual(Object.keys(lifetime), ['close', 'dispatch']); assert.ok(Object.isFrozen(lifetime));
  assert.ok(input.vaultKey.every(x => x === 0)); assert.ok(input.sessionSigningKey.every(x => x === 0));
  await Promise.all([lifetime.close(), lifetime.close()]); assert.deepEqual(events, ['database', 'vault', 'composition', 'disconnect']);
});
test('graph failure disconnects actual owned client port and wipes mutable staging', async () => {
  const { initialize, events } = load(true); const input = material();
  await assert.rejects(initialize(input), /private_bootstrap_initialization_unavailable/);
  assert.deepEqual(events, ['database', 'vault', 'composition', 'disconnect']); assert.ok(input.vaultKey.every(x => x === 0));
});
test('rejects unknown fields, accessor records, wrong bounds before factory construction', async () => {
  for (const input of [Object.freeze({ ...material(), extra: true }), Object.freeze({ datasource: 'postgresql://synthetic.invalid/example', vaultKey: new Uint8Array(31), sessionSigningKey: new Uint8Array(32) }), Object.freeze({ get datasource() { throw Error('accessor must never run'); }, vaultKey: new Uint8Array(32), sessionSigningKey: new Uint8Array(32) })]) {
    const { initialize, events } = load(); await assert.rejects(initialize(input), /private_bootstrap_initialization_unavailable/); assert.deepEqual(events, []);
  }
});

test('unavailable actual canonical reader refuses before resource construction',async()=>{
 const {initialize,events}=load(false,false);await assert.rejects(initialize(material()),/private_bootstrap_initialization_unavailable/);assert.deepEqual(events,[]);
});
test('owned dispatch checks canonical currentness and closed lifetime refuses reuse',async()=>{
 const {initialize,events,revoke}=load();const lifetime=await initialize(material());
 const result=await lifetime.dispatch(new Uint8Array([1]),new AbortController().signal);assert.equal(result.status,200);assert.equal(events.filter(x=>x==='dispatch').length,1);
 revoke();await assert.rejects(lifetime.dispatch(new Uint8Array([2]),new AbortController().signal));
 await lifetime.close();await assert.rejects(lifetime.dispatch(new Uint8Array([3]),new AbortController().signal));assert.equal(events.filter(x=>x==='dispatch').length,1);
});

test('close disables admission before pending work and disconnects once',async()=>{
 const {initialize,events}=load();const lifetime=await initialize(material());
 const pending=lifetime.dispatch(new Uint8Array([1]),new AbortController().signal);
 const closed=lifetime.close();await assert.rejects(pending);await closed;
 assert.equal(events.filter(x=>x==='dispatch').length,0);assert.equal(events.filter(x=>x==='disconnect').length,1);
 await lifetime.close();assert.equal(events.filter(x=>x==='disconnect').length,1);
});
test('overlapping owned dispatch refuses instead of queuing',async()=>{
 const {initialize}=load();const lifetime=await initialize(material());const first=lifetime.dispatch(new Uint8Array([1]),new AbortController().signal);
 await assert.rejects(lifetime.dispatch(new Uint8Array([2]),new AbortController().signal));await first;await lifetime.close();
});

test('adapter abort does not release native context while actual handler is unsettled',async()=>{
 const {initialize,events,finish}=load(false,true,true);const lifetime=await initialize(material());const controller=new AbortController();let settled=false;
 const pending=lifetime.dispatch(new Uint8Array([1]),controller.signal);void pending.then(()=>{settled=true},()=>{settled=true});
 await new Promise(resolve=>setImmediate(resolve));assert.ok(events.includes('handler'));controller.abort();await new Promise(resolve=>setImmediate(resolve));assert.equal(settled,false);
 await assert.rejects(lifetime.dispatch(new Uint8Array([2]),new AbortController().signal));finish();await assert.rejects(pending);await lifetime.close();
});

test('unknown handler disposal closes lifetime instead of admitting a new request',async()=>{
 const {initialize,expireDisposal}=load(false,true,true);const lifetime=await initialize(material());const controller=new AbortController();const pending=lifetime.dispatch(new Uint8Array([1]),controller.signal);
 await new Promise(resolve=>setImmediate(resolve));controller.abort();expireDisposal();await assert.rejects(pending,/private_bootstrap_drain_unknown/);await assert.rejects(lifetime.dispatch(new Uint8Array([2]),new AbortController().signal));await lifetime.close();
});
