import {afterEach,expect,it,vi} from 'vitest';
import process from 'node:process';
const state=vi.hoisted(()=>({initializer:null as any,load:vi.fn(),writes:[] as string[],writeHook:null as null|(()=>void),callbackMode:'success' as 'success'|'never'|'error',listeners:new Map<string,()=>void>()}));
vi.mock('node:module',()=>({createRequire:()=>state.load}));
vi.mock('node:process',()=>({default:{argv:['node','/opt/axiom-operational-time/private/main.mjs'],versions:{node:'24.22.2'},stdout:{write:(s:string,cb:(error?:Error)=>void)=>{state.writeHook?.();state.writes.push(s);if(state.callbackMode==='success')cb();else if(state.callbackMode==='error')queueMicrotask(()=>cb(Error('private-stream-error')));return true}},once:(s:string,f:()=>void)=>state.listeners.set(s,f),removeListener:(s:string)=>state.listeners.delete(s),exitCode:undefined}}));
afterEach(()=>{vi.resetModules();vi.useRealTimers();state.writes=[];state.writeHook=null;state.callbackMode='success';process.argv=['node','/opt/axiom-operational-time/private/main.mjs'];Object.assign(process.versions,{node:'24.22.2'});process.exitCode=undefined;state.listeners.clear();state.load.mockReset()});
function fixture(){const context={profileDigest:'a'.repeat(64),revision:1,hostGeneration:'h',sourceGeneration:'s',source:'amazon-ipv4-ntp'},held={},capture={identity:held},sample={context,unixTimeNs:BigInt(100),monotonicBeforeNs:BigInt(1),monotonicAfterNs:BigInt(2),publication:BigInt(1),disruptionMarker:BigInt(0)};const raw={hold:vi.fn(async()=>held),start:vi.fn(()=>({result:Promise.resolve(capture),completed:Promise.resolve(),terminate:vi.fn(async()=>{})})),release:vi.fn(async()=>{}),assertResourceCurrent:vi.fn(async()=>{})};const initializer={context,raw,beginObservation:vi.fn(),sampleOriginal:vi.fn(async(h:unknown,c:unknown)=>{expect(h).toBe(held);expect(c).toBe(capture);return sample}),assertObservationCurrent:vi.fn(async (s:unknown)=>{expect(s).toBe(sample)}),retire:vi.fn()};state.initializer=initializer;state.load.mockReturnValue(initializer);return{initializer,raw,held,sample}}
it('loads only fixed original addon; final currentness/release/retire precede fixed unqualified receipt',async()=>{const f=fixture();state.writeHook=()=>{expect(f.initializer.retire).toHaveBeenCalledOnce();expect(f.raw.release).toHaveBeenCalledOnce()};await (await import('../installedOperationalMain')).completion;expect(state.load).toHaveBeenCalledExactlyOnceWith('/opt/axiom-operational-time/private/operational.node');expect(f.initializer.assertObservationCurrent).toHaveBeenCalledOnce();expect(f.raw.release).toHaveBeenCalledExactlyOnceWith(f.held);expect(f.initializer.retire).toHaveBeenCalledOnce();expect(JSON.parse(state.writes[0])).toEqual({format:1,event:'operational_supplier_observed',qualified:false,governanceEnabled:false,administrativeResult:'unqualified',cleanup:'not_attested'});expect(state.writes.join('')).not.toContain('100');expect(state.listeners.size).toBe(0)});
it('refuses foreign sample context without publishing observed event',async()=>{const f=fixture();f.sample.context={...f.sample.context};await (await import('../installedOperationalMain')).completion;expect(JSON.parse(state.writes[0]).event).toBe('operational_supplier_refused');expect(f.initializer.retire).toHaveBeenCalledOnce()});
it('owns cancellation and releases late hold without worker or second acquisition',async()=>{vi.useFakeTimers();const f=fixture();let resolve!:(h:any)=>void;f.raw.hold.mockReturnValue(new Promise(r=>resolve=r));const pending=import('../installedOperationalMain').then(m=>m.completion);await vi.waitFor(()=>expect(f.raw.hold).toHaveBeenCalledOnce());state.listeners.get('SIGTERM')!();await vi.advanceTimersByTimeAsync(101);await pending;resolve(f.held);await vi.advanceTimersByTimeAsync(0);expect(f.raw.release).toHaveBeenCalledExactlyOnceWith(f.held);expect(f.raw.start).not.toHaveBeenCalled();expect(JSON.parse(state.writes[0]).event).toBe('operational_supplier_refused')});
it('retains refusal when addon initialization fails; no arbitrary error text reaches receipt',async()=>{fixture();state.load.mockImplementation(()=>{throw Error('secret-provider-detail')});await (await import('../installedOperationalMain')).completion;expect(state.writes).toHaveLength(1);expect(state.writes[0]).not.toContain('secret');expect(JSON.parse(state.writes[0]).qualified).toBe(false)});

it('contains stream-write failure without retry or claiming parent cleanup',async()=>{const f=fixture();state.writeHook=()=>{throw Error('stream failure')};await (await import('../installedOperationalMain')).completion;expect(f.initializer.retire).toHaveBeenCalledOnce();expect(state.writes).toHaveLength(0);expect(state.listeners.size).toBe(0)});

it.each([
 ['wrong path',['node','/tmp/main.mjs']],
 ['missing installed path',['node']],
 ['extra arguments',['node','/opt/axiom-operational-time/private/main.mjs','--addon=/tmp/other.node']],
])('refuses %s before loading addon',async(_label,argv)=>{
 fixture();process.argv=argv;
 await (await import('../installedOperationalMain')).completion;
 expect(state.load).not.toHaveBeenCalled();expect(process.exitCode).toBe(70);
 expect(JSON.parse(state.writes[0])).toMatchObject({event:'operational_supplier_refused',qualified:false,administrativeResult:'unqualified',cleanup:'not_attested'});
});
it('refuses wrong Node version before loading addon',async()=>{
 fixture();Object.assign(process.versions,{node:'24.22.3'});
 await (await import('../installedOperationalMain')).completion;
 expect(state.load).not.toHaveBeenCalled();expect(process.exitCode).toBe(70);
 expect(JSON.parse(state.writes[0]).event).toBe('operational_supplier_refused');
});
it('bounds a never-arriving stdout callback at100ms with no second write or cleanup claim',async()=>{
 vi.useFakeTimers();const f=fixture();state.callbackMode='never';
 let writeStarted!:()=>void;const started=new Promise<void>(resolve=>{writeStarted=resolve});state.writeHook=()=>writeStarted();
 let settled=false;const pending=import('../installedOperationalMain').then(m=>m.completion).then(()=>{settled=true});
 await started;expect(state.writes).toHaveLength(1);
 await vi.advanceTimersByTimeAsync(99);expect(settled).toBe(false);
 await vi.advanceTimersByTimeAsync(1);await pending;
 expect(process.exitCode).toBe(70);expect(state.writes).toHaveLength(1);expect(state.listeners.size).toBe(0);
 expect(f.initializer.retire).toHaveBeenCalledOnce();
 expect(JSON.parse(state.writes[0])).toMatchObject({qualified:false,administrativeResult:'unqualified',cleanup:'not_attested'});
 await vi.advanceTimersByTimeAsync(1000);expect(state.writes).toHaveLength(1);
});
it('handles asynchronous stdout callback error without retry or exposing details',async()=>{
 const f=fixture();state.callbackMode='error';await (await import('../installedOperationalMain')).completion;
 expect(process.exitCode).toBe(70);expect(state.writes).toHaveLength(1);expect(state.writes[0]).not.toContain('private-stream-error');
 expect(JSON.parse(state.writes[0])).toMatchObject({qualified:false,administrativeResult:'unqualified',cleanup:'not_attested'});
 expect(f.initializer.retire).toHaveBeenCalledOnce();expect(state.listeners.size).toBe(0);
});
