import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {expect,it} from 'vitest';
import {decodeTimePublication,encodeTimePublication,type TimePublication} from '../record';
import {encloseTimePublication,type NativeTimeSample,type TimePremises} from '../interval';

const root=process.cwd(),audit=resolve(root,'docs/recovery/2026-11-13/real-governance-qualification/design');
const patchPath=resolve(root,'packages/verified-issuer-runtime/linux/clockbound-daemon-integration.patch');
const inputs:Record<string,string>={
 'clock-bound/src/daemon.rs':'daemon-constructor-audit/PUBLIC-READ-1.txt',
 'clock-bound/src/daemon/clock_state.rs':'daemon-constructor-audit/PUBLIC-READ-2.txt',
 'clock-bound/src/daemon/clock_state/shm_writer/shm0.rs':'five-file-structural-audit/PUBLIC-READ-4.txt',
};
/** Apply actual reviewed unified source hunks in memory, refusing unmatched or
 * overlapping context. This does not compile or execute fetched Rust. */
function patched(){
 const output=new Map(Object.entries(inputs).map(([name,file])=>[name,readFileSync(resolve(audit,file),'utf8')]));
 // Diagnostic mode intentionally evaluates the same order assertions against untouched pinned upstream.
 if(process.env.AXIOM_DAEMON_UPSTREAM_BASELINE==='1')return output;
 const lines=readFileSync(patchPath,'utf8').split('\n');let i=0,changed=0;
 while(i<lines.length){
  if(!lines[i].startsWith('--- ')){i++;continue}
  const old=lines[i++].slice(4).split('\t')[0].replace(/^a\//,''),next=lines[i++];
  if(!next?.startsWith('+++ '))throw Error('invalid patch file');
  const name=next.slice(4).split('\t')[0].replace(/^b\//,'');
  if(name!==old||!output.has(name))throw Error('unreviewed patch target');
  const original=output.get(name)!.split('\n'),result:string[]=[];let cursor=0;
  while(i<lines.length&&!lines[i].startsWith('--- ')&&!lines[i].startsWith('diff ')){
   const header=/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(lines[i]);
   if(!header){i++;continue}i++;
   const at=Number(header[1])-1,oldCount=Number(header[2]??1),newCount=Number(header[4]??1);let removed=0,added=0;
   if(at<cursor)throw Error('overlapping hunk');result.push(...original.slice(cursor,at));cursor=at;
   while(i<lines.length&&!lines[i].startsWith('@@ ')&&!lines[i].startsWith('--- ')&&!lines[i].startsWith('diff ')){
    const line=lines[i];if(line===''){i++;break}if(line.startsWith('\\'))throw Error('unsupported no-newline marker');
    if(line[0]===' '||line[0]==='-'){if(original[cursor++]!==line.slice(1))throw Error('source context mismatch');removed++}
    if(line[0]===' '||line[0]==='+'){result.push(line.slice(1));added++}
    if(![' ','-','+'].includes(line[0]))throw Error('invalid hunk line');i++;
   }
   if(removed!==oldCount||added!==newCount)throw Error('hunk length mismatch');changed++;
  }
  result.push(...original.slice(cursor));output.set(name,result.join('\n'));
 }
 if(changed<1)throw Error('missing integration hunks');return output;
}
function fn(source:string,name:string){
 // Mask strings/comments without changing indices, then balance the actual body.
 const masked=source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"/g,text=>' '.repeat(text.length));
 const match=new RegExp('\\bfn\\s+'+name+'\\s*\\(').exec(masked);if(!match)throw Error('missing function '+name);
 const begin=masked.indexOf('{',match.index);let depth=1,end=begin+1;for(;end<masked.length&&depth;end++){if(masked[end]==='{')depth++;else if(masked[end]==='}')depth--}
 if(depth)throw Error('unclosed function');return source.slice(begin+1,end-1);
}
function body(file:string,name:string){const source=patched().get('clock-bound/src/'+file);if(!source)throw Error('missing patched file');return fn(source,name)}
function before(source:string,left:string,right:string){const a=source.indexOf(left),b=source.indexOf(right);expect(a,left).toBeGreaterThanOrEqual(0);expect(b,right).toBeGreaterThan(a)}

it('applies the actual patch only to the three exact saved source inputs',()=>{expect([...patched().keys()].sort()).toEqual(Object.keys(inputs).sort())});
it('threads explicit owned context through the actual qualified daemon and V2 construction',()=>{
 const daemon=body('daemon.rs','construct_axiom'),clock=body('daemon/clock_state.rs','construct_axiom');
 expect(daemon).toContain('ClockState::construct_axiom');expect(daemon).toContain('publisher');
 expect(clock).toContain('wrap_v2');expect(clock).toContain('Box::new(shm_writer_0)');expect(clock).not.toMatch(/wrap_v2\s*\([^;]*shm_writer_1/);
});
it('actual ClockState startup invalidates unconditionally before entering its event loop',()=>{
 const run=body('daemon/clock_state.rs','run');before(run,'self.shm0.initialize()','loop {');
 const initialize=body('daemon/clock_state/shm_writer/shm0.rs','initialize');
 expect(initialize).toContain('self.invalidate_unknown()');expect(initialize).not.toMatch(/if\s+let|create_shm_snapshot/);
});
it('actual correction invalidates before the discipliner and publishes a newly derived V2 afterward',()=>{
 const source=body('daemon/clock_state.rs','handle_sync_parameters');before(source,'self.shm0.invalidate_unknown()','.handle_clock_parameters(parameters)');
 before(source,'.handle_clock_parameters(parameters)','self.shm0\n');
 expect(source).toMatch(/self\.shm0\s*\.handle_clock_parameters\(parameters, clock_status_v2\)/);
});
it('actual disruption invalidates the new marker even without existing sync parameters',()=>{
 const source=body('daemon/clock_state.rs','handle_disruption');before(source,'shm0.invalidate_disruption(disruption_marker)','if let Some(sp) = sync_parameters');
 expect(source).not.toContain('shm0.handle_disruption(&sp.clock_parameters, disruption_marker)');
});
it('startup/disruption invalidation uses a mandatory unusable V2 publication, never conditional drift calculation',()=>{
 const source=patched().get('clock-bound/src/daemon/clock_state/shm_writer/shm0.rs')!;
 const startup=fn(source,'invalidate_unknown'),disruption=fn(source,'invalidate_disruption');
 expect(startup).toContain('ClockStatus::Unknown');expect(disruption).toContain('ClockStatus::Disrupted');
 expect(disruption).toContain('self.disruption_marker =');expect(startup+disruption).not.toContain('create_shm_snapshot');
});

it('preserves both stock constructors and requires a nonoptional context on both qualified constructors',()=>{
 for(const file of ['daemon.rs','daemon/clock_state.rs']){
  const name='clock-bound/src/'+file,source=patched().get(name)!,original=readFileSync(resolve(audit,inputs[name]),'utf8');
  expect(fn(source,'construct')).toBe(fn(original,'construct'));
  const signature=/fn construct_axiom\(([\s\S]*?)\) -> Self/.exec(source)?.[1];expect(signature).toBeDefined();
  expect(signature).toMatch(/axiom_publisher:\s*(?:super::)?time_publication_adapter::NativeTimePublisherContext/);
  expect(signature).not.toMatch(/axiom_publisher:\s*Option</); // Separate VMClock optionality is preserved.
 }
});
it('unusable sentinel reaches the actual writer directly and contains explicit V2/status/marker fields',()=>{
 const source=body('daemon/clock_state/shm_writer/shm0.rs','invalidate');
 expect(source).toContain('.as_of(TimeSpec::new(0, 0))');expect(source).toContain('.void_after(TimeSpec::new(0, 1))');
 expect(source).toContain('.clock_status(status)');expect(source).toContain('.disruption_marker(self.disruption_marker)');
 expect(source).toContain('.build(ClockErrorBoundLayoutVersion::V2)');expect(source).toContain('self.shm_writer.write(&ceb)');
 expect(source).not.toMatch(/if\s+let|create_shm_snapshot|unwrap_or_default/);
});

it.each(['unknown','disrupted'] as const)('real codec accepts the exact %s sentinel but interval refuses it before sample/premise arithmetic',status=>{
 const raw:TimePublication={version:2,layout:'clockbound-precise-origin-v1',sourceGeneration:'synthetic-owned-generation',publication:BigInt('1'),asOfNs:BigInt('0'),voidAfterNs:BigInt('1'),boundNs:BigInt('0'),driftPpb:BigInt('0'),status,disruptionMarker:BigInt('7'),disruptionSupported:true};
 const decoded=decodeTimePublication(encodeTimePublication(raw));expect(decoded).toEqual(raw);
 let sampleReads=0,premiseReads=0;
 const sample:NativeTimeSample={get realtimeNs(): bigint {sampleReads++;throw Error('sample must not be read')},get p0(): NativeTimeSample['p0'] {sampleReads++;throw Error('sample must not be read')},get p1(): NativeTimeSample['p1'] {sampleReads++;throw Error('sample must not be read')},get p2(): NativeTimeSample['p2'] {sampleReads++;throw Error('sample must not be read')}};
 const premises:TimePremises={get asOf(): TimePremises['asOf'] {premiseReads++;throw Error('premise must not be read')},get voidAfter(): TimePremises['voidAfter'] {premiseReads++;throw Error('premise must not be read')},get maxAgeNs(): TimePremises['maxAgeNs'] {premiseReads++;throw Error('premise must not be read')},get lambdaMin(): TimePremises['lambdaMin'] {premiseReads++;throw Error('premise must not be read')},get lambdaMax(): TimePremises['lambdaMax'] {premiseReads++;throw Error('premise must not be read')}};
 expect(()=>encloseTimePublication(decoded,sample,premises)).toThrow('native_time_interval_unavailable');expect(sampleReads).toBe(0);expect(premiseReads).toBe(0);
});
