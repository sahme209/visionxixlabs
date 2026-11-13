import {it,expect} from 'vitest';
import {assertExecutionWindow,authorizeExecutionWindow} from '../executionTime';
const signal=()=>new AbortController().signal;
it('retains the original deadline if the source changes the caller object while awaited',async()=>{
 const window={expiresAt:100};
 await expect(assertExecutionWindow(async()=>{window.expiresAt=1000;return {earliest:99,latest:100}},window,signal())).rejects.toThrow('platform_execution_time_unavailable');
});
it.each([{earliest:99,latest:100},{earliest:101,latest:100},{earliest:-1,latest:0},{earliest:1,latest:NaN},{earliest:1,latest:Number.MAX_SAFE_INTEGER+1}])('refuses expiry overlap or malformed intervals: %j',async interval=>{
 await expect(assertExecutionWindow(async()=>interval,{expiresAt:100},signal())).rejects.toThrow('platform_execution_time_unavailable');
});
it('does not use the upper bound to accept future not-before authority',async()=>{
 await expect(assertExecutionWindow(async()=>({earliest:99,latest:101}),{notBefore:100,expiresAt:102},signal())).rejects.toThrow();
});
it('retains cancellation across the awaited clock read',async()=>{
 const controller=new AbortController();
 await expect(assertExecutionWindow(async()=>{controller.abort();return {earliest:100,latest:101}},{expiresAt:102},controller.signal)).rejects.toThrow();
});
it('returns a captured interval only when the full validity window is satisfied',async()=>{
 const interval={earliest:100,latest:101};const result=await assertExecutionWindow(async()=>interval,{notBefore:100,expiresAt:102},signal());interval.latest=1000;
 expect(result).toEqual({earliest:100,latest:101});expect(Object.isFrozen(result)).toBe(true);
});

it('retires the private check if authorization returned without using it',async()=>{
 let saved:(()=>Promise<void>)|undefined,reads=0;
 await expect(authorizeExecutionWindow(async()=>{reads++;return {earliest:1,latest:2}},{expiresAt:3},async check=>{saved=check},signal())).rejects.toThrow();
 expect(saved).toBeTypeOf('function');await expect(saved!()).rejects.toThrow();expect(reads).toBe(0);
});
it.each(['omit','double','rejected','pending','lost-ack'] as const)('never grants a time-authorized send after %s acknowledgement',async mode=>{
 let finish!:()=>void;const deferred=new Promise<void>(r=>{finish=r});
 const source=async()=>{if(mode==='pending')await deferred;return {earliest:1,latest:2}};
 const authorization=async(check?:()=>Promise<void>)=>{
  if(!check)throw Error('missing');
  if(mode==='omit')return;
  if(mode==='pending'){void check().catch(()=>{});return}
  await check();
  if(mode==='double'){try{await check()}catch{}return}
  if(mode==='rejected'||mode==='lost-ack')throw Error('synthetic refused or lost commit');
 };
 await expect(authorizeExecutionWindow(source,{expiresAt:3},authorization,signal())).rejects.toThrow();finish();
});
it('accepts only a successfully awaited private check and acknowledged authorization',async()=>{
 let completed=false;await authorizeExecutionWindow(async()=>({earliest:1,latest:2}),{expiresAt:3},async check=>{await check!();completed=true},signal());expect(completed).toBe(true);
});

it('intersects the locked participant expiry with the original native deadline',async()=>{
 await expect(authorizeExecutionWindow(async()=>({earliest:49,latest:50}),{expiresAt:100},async check=>{await check!({expiresAt:50})},signal())).rejects.toThrow();
});
it('additional participant bounds can never relax the immutable original window',async()=>{
 await expect(authorizeExecutionWindow(async()=>({earliest:99,latest:100}),{notBefore:50,expiresAt:100},async check=>{await check!({notBefore:0,expiresAt:1000})},signal())).rejects.toThrow();
 await expect(authorizeExecutionWindow(async()=>({earliest:49,latest:51}),{notBefore:50,expiresAt:100},async check=>{await check!({notBefore:0,expiresAt:1000})},signal())).rejects.toThrow();
});
it('captures additional bounds before the source can mutate them',async()=>{
 const extra={notBefore:50,expiresAt:100};
 await expect(authorizeExecutionWindow(async()=>{extra.notBefore=0;extra.expiresAt=1000;return {earliest:99,latest:100}},{expiresAt:200},async check=>{await check!(extra)},signal())).rejects.toThrow();
});
it.each([{notBefore:NaN},{expiresAt:-1},{notBefore:Infinity},{expiresAt:1.5}])('rejects malformed participant bounds without reading the source: %j',async extra=>{
 let reads=0;await expect(authorizeExecutionWindow(async()=>{reads++;return {earliest:1,latest:2}},{expiresAt:100},async check=>{await check!(extra)},signal())).rejects.toThrow();expect(reads).toBe(0);
});

it('cannot hide an invalid original authority bound by intersecting it with a valid restriction',async()=>{
 await expect(authorizeExecutionWindow(async()=>({earliest:1,latest:2}),{notBefore:-1,expiresAt:100},async check=>{await check!({notBefore:0,expiresAt:50})},signal())).rejects.toThrow();
});
