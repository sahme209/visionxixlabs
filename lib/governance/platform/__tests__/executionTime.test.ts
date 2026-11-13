import {it,expect} from 'vitest';
import {assertExecutionWindow,authorizeExecutionWindow,prepareExecutionDispatch,consumeExecutionDispatch} from '../executionTime';
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
it('required native final facts run inside the acknowledged owner after its final awaited checks',async()=>{
 const order:string[]=[];await authorizeExecutionWindow(async()=>({earliest:1,latest:2}),{expiresAt:3},async(check,final)=>{await check!();await Promise.resolve();order.push('owner-final-check');await final!();order.push('commit-ack')},signal(),async()=>{order.push('native-facts')});expect(order).toEqual(['owner-final-check','native-facts','commit-ack']);
});
it.each(['omitted','repeated','before-time','pending'] as const)('refuses required native final facts that are %s',async mode=>{
 let finish!:()=>void;const waiting=new Promise<void>(r=>{finish=r});
 await expect(authorizeExecutionWindow(async()=>({earliest:1,latest:2}),{expiresAt:3},async(check,final)=>{
  if(mode==='before-time'){await final!();return}await check!();if(mode==='omitted')return;
  if(mode==='pending'){void final!().catch(()=>{});return}await final!();try{await final!()}catch{}
 },signal(),async()=>{if(mode==='pending')await waiting})).rejects.toThrow('platform_execution_time_unavailable');finish();
});
it.each([{notBefore:NaN},{expiresAt:-1},{notBefore:Infinity},{expiresAt:1.5}])('rejects malformed participant bounds without reading the source: %j',async extra=>{
 let reads=0;await expect(authorizeExecutionWindow(async()=>{reads++;return {earliest:1,latest:2}},{expiresAt:100},async check=>{await check!(extra)},signal())).rejects.toThrow();expect(reads).toBe(0);
});

it('cannot hide an invalid original authority bound by intersecting it with a valid restriction',async()=>{
 await expect(authorizeExecutionWindow(async()=>({earliest:1,latest:2}),{notBefore:-1,expiresAt:100},async check=>{await check!({notBefore:0,expiresAt:50})},signal())).rejects.toThrow();
});


it('committed dispatch retains the original tighter window when acknowledgement arrives at expiry',async()=>{
 let now=1,owners=0,facts=0;const binding=Object.freeze({phase:'test.send'});
 const proof=await prepareExecutionDispatch(async()=>({earliest:now,latest:now}),{expiresAt:100},async check=>{owners++;await check!({expiresAt:5});now=5},signal(),binding,async()=>{facts++});
 await expect(consumeExecutionDispatch(proof,binding)).rejects.toThrow('platform_execution_time_unavailable');expect(owners).toBe(1);expect(facts).toBe(0);
 await expect(consumeExecutionDispatch(proof,binding)).rejects.toThrow();
});
it('dispatch consumes before awaits, refuses clone/substitution/reentry and never reauthorizes',async()=>{
 let owners=0,reads=0,release!:()=>void;const wait=new Promise<void>(r=>{release=r});const binding=Object.freeze({phase:'test.send'});
 const proof=await prepareExecutionDispatch(async()=>{if(++reads===2)await wait;return {earliest:1,latest:2}},{expiresAt:5},async check=>{owners++;await check!()},signal(),binding,async()=>{});
 await expect(consumeExecutionDispatch({...proof},binding)).rejects.toThrow();
 const pending=consumeExecutionDispatch(proof,binding);await expect(consumeExecutionDispatch(proof,binding)).rejects.toThrow();release();await pending;expect(owners).toBe(1);expect(reads).toBe(2);
 const second=await prepareExecutionDispatch(async()=>({earliest:1,latest:2}),{expiresAt:5},async c=>{await c!()},signal(),binding,async()=>{});
 await expect(consumeExecutionDispatch(second,Object.freeze({phase:'test.send'}))).rejects.toThrow();await expect(consumeExecutionDispatch(second,binding)).rejects.toThrow();
});
it('dispatch captures restrictions before mutation and rechecks original currentness after its clock',async()=>{
 let now=1,live=true;const extra={expiresAt:5},binding=Object.freeze({phase:'test.read'});let count=0;
 const proof=await prepareExecutionDispatch(async()=>{if(++count===2){live=false;return {earliest:1,latest:2}}return {earliest:now,latest:now}},{expiresAt:100},async c=>{await c!(extra);extra.expiresAt=100},signal(),binding,async()=>{if(!live)throw Error('revoked')});
 await expect(consumeExecutionDispatch(proof,binding)).rejects.toThrow();
});
it('failed owner acknowledgement creates no checkpoint and canceled final clock never reaches dispatch facts',async()=>{
 const binding=Object.freeze({phase:'test.send'});let checks=0;
 await expect(prepareExecutionDispatch(async()=>({earliest:1,latest:2}),{expiresAt:5},async c=>{await c!();throw Error('lost ack')},signal(),binding,async()=>{checks++})).rejects.toThrow();
 const abort=new AbortController();let n=0;const proof=await prepareExecutionDispatch(async()=>{if(++n===2)abort.abort();return {earliest:1,latest:2}},{expiresAt:5},async c=>{await c!()},abort.signal,binding,async()=>{checks++});
 await expect(consumeExecutionDispatch(proof,binding)).rejects.toThrow();expect(checks).toBe(0);
});
it('checkpoint preparation rejects mutable bindings before owner or clock work',async()=>{
 let owners=0;await expect(prepareExecutionDispatch(async()=>({earliest:1,latest:2}),{expiresAt:5},async c=>{owners++;await c!()},signal(),{phase:'mutable'},async()=>{})).rejects.toThrow();expect(owners).toBe(0);
});
