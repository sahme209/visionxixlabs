import {afterEach,it,expect,vi} from 'vitest';
import {dispatchWorkflow} from '../githubWriteClient';
afterEach(()=>vi.unstubAllGlobals());
const input={owner:'owner',repo:'repo',workflowFile:'deploy.yml',ref:'refs/tags/v1',inputs:{},installationToken:'SIMULATED_TOKEN'};
it('checks synchronous committed intent after awaited authority immediately before the one POST',async()=>{
 let current=false;const order:string[]=[];const fetch=vi.fn(async()=>{expect(current).toBe(true);order.push('POST');return Response.json({workflow_run_id:42})});vi.stubGlobal('fetch',fetch);
 const result=await dispatchWorkflow({...input,beforeWrite:async()=>{order.push('authority');await Promise.resolve();current=true},beforeFetch:()=>{expect(current).toBe(true);order.push('intent')}} as any);
 expect(result.ok).toBe(true);expect(order).toEqual(['authority','intent','POST']);expect(fetch).toHaveBeenCalledOnce();
});
it('withholds POST when postcommit freshness expires or callback returns asynchronous work',async()=>{
 const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
 const expired=await dispatchWorkflow({...input,beforeWrite:async()=>{},beforeFetch:()=>{throw Error('expired')}} as any);expect(expired.ok).toBe(false);expect(fetch).not.toHaveBeenCalled();
 const asyncResult=await dispatchWorkflow({...input,beforeWrite:async()=>{},beforeFetch:()=>Promise.resolve()} as any);expect(asyncResult.ok).toBe(false);expect(fetch).not.toHaveBeenCalled();
});

it('bounds dispatch fetch and body by the original signal; cancellation after POST remains unknown',async()=>{
 const controller=new AbortController();const fetch=vi.fn((_url:any,init:any)=>{expect(init.signal).toBe(controller.signal);return new Promise(()=>{})});vi.stubGlobal('fetch',fetch);
 const pending=dispatchWorkflow({...input,beforeWrite:async()=>{},beforeFetch:()=>{},signal:controller.signal});await vi.waitFor(()=>expect(fetch).toHaveBeenCalledOnce());controller.abort();expect(await pending).toEqual({ok:false,error:'workflow_dispatch_failed: action_outcome_unknown'});
 const body=new AbortController();vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:()=>{body.abort();return Promise.reject(Error('body aborted'))}})));
 expect(await dispatchWorkflow({...input,beforeWrite:async()=>{},beforeFetch:()=>{},signal:body.signal})).toEqual({ok:false,error:'workflow_dispatch_failed: action_outcome_unknown'});
});
