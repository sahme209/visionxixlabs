import {IncomingMessage} from "node:http";
import {Socket} from "node:net";
import {getEventListeners} from "node:events";
import {setImmediate as nextTurn,setTimeout as delay} from "node:timers/promises";
import {HttpRequest} from "@smithy/core/protocols";
import {streamCollector,type NodeHttpHandler} from "@smithy/node-http-handler";
import {expect,it,vi} from "vitest";
import {boundedAwsHandler} from "@/lib/cloud/aws/ecsObservation/boundedAwsHandler";
it.each([{method:"GET",headObjectMetadata:false},{method:"GET",headObjectMetadata:true},{method:"HEAD",headObjectMetadata:false}])("delivers ordinary body overflow to a late SDK collector for %j",async options=>{
 const source=new IncomingMessage(new Socket());source.push(Buffer.from("synthetic-over-budget"));source.push(null);
 const native={handle:vi.fn(async()=>({response:{statusCode:200,headers:{},body:source}})),destroy:vi.fn()};
 const budget={remaining:8},handler=boundedAwsHandler(new AbortController().signal,budget,{...options,native:native as unknown as NodeHttpHandler});
 try{
  const result=await handler.handle(new HttpRequest({method:options.method,hostname:"s3.us-east-1.amazonaws.com"}));
  await nextTurn();
  // Emulate deserializer scheduling after the handler returns. The actual SDK
  // collector must observe rejection even with an already-buffered source.
  const outcome=await Promise.race([streamCollector(result.response.body).then(()=>"resolved",()=>"rejected"),new Promise(resolve=>setTimeout(()=>resolve("pending"),30))]);
  expect(outcome).toBe("rejected");expect(budget.remaining).toBe(0);expect(source.destroyed).toBe(true);
 }finally{handler.destroy();}
});
it("removes every external abort listener/timer and active native body even when there is no consumer",async()=>{
 vi.useFakeTimers();const source=new IncomingMessage(new Socket()),destroy=vi.spyOn(source,"destroy"),parent=new AbortController(),call=new AbortController();
 const native={handle:vi.fn(async(_request:unknown,_options:{abortSignal:AbortSignal})=>{void _request;void _options;return {response:{statusCode:200,headers:{},body:source}};}),destroy:vi.fn()};
 const handler=boundedAwsHandler(parent.signal,{remaining:8},{timeoutMs:1000,native:native as unknown as NodeHttpHandler});
 try{
  await handler.handle(new HttpRequest({method:"GET",hostname:"s3.us-east-1.amazonaws.com"}),{abortSignal:call.signal});
  expect(vi.getTimerCount()).toBe(1);parent.abort();expect(source.destroyed).toBe(true);expect(vi.getTimerCount()).toBe(0);
  for(const signal of [parent.signal,call.signal,native.handle.mock.calls[0][1].abortSignal])expect(getEventListeners(signal,"abort")).toHaveLength(0);
  const stopped=destroy.mock.calls.length;handler.destroy();expect(destroy.mock.calls).toHaveLength(stopped);expect(native.destroy).toHaveBeenCalledOnce();
 }finally{handler.destroy();source.destroy();vi.useRealTimers();}
});
it("still rejects source failure after the SDK has started ordinary consumption",async()=>{
 const source=new IncomingMessage(new Socket());
 const native={handle:vi.fn(async()=>({response:{statusCode:200,headers:{},body:source}})),destroy:vi.fn()};
 const handler=boundedAwsHandler(new AbortController().signal,{remaining:8},{native:native as unknown as NodeHttpHandler});
 try{
  const result=await handler.handle(new HttpRequest({method:"GET",hostname:"s3.us-east-1.amazonaws.com"})),collected=streamCollector(result.response.body);
  const rejected=expect(collected).rejects.toThrow("aws_response_unavailable");await nextTurn();source.destroy(Error("synthetic source failure"));await rejected;expect(source.destroyed).toBe(true);
 }finally{handler.destroy();source.destroy();}
});
it.each(["deadline","parentAbort","sourceError","destroy"])("retains %s failure for a late SDK collector while promptly cleaning native resources",async mode=>{
 const source=new IncomingMessage(new Socket()),parent=new AbortController();
 const native={handle:vi.fn(async()=>({response:{statusCode:200,headers:{},body:source}})),destroy:vi.fn()};
 const handler=boundedAwsHandler(parent.signal,{remaining:8},{timeoutMs:mode==="deadline"?10:1000,native:native as unknown as NodeHttpHandler});
 try{
  const result=await handler.handle(new HttpRequest({method:"GET",hostname:"s3.us-east-1.amazonaws.com"}));
  if(mode==="deadline")await delay(20);if(mode==="parentAbort")parent.abort();if(mode==="sourceError")source.destroy(Error("synthetic source failure"));if(mode==="destroy")handler.destroy();
  await nextTurn();expect(source.destroyed).toBe(true);
  const outcome=await Promise.race([streamCollector(result.response.body).then(()=>"resolved",()=>"rejected"),delay(30,"pending")]);expect(outcome).toBe("rejected");
 }finally{handler.destroy();source.destroy();}
});
it("refuses native headers that arrive after the already-running deadline",async()=>{
 const source=new IncomingMessage(new Socket());
 const native={handle:vi.fn(async()=>{await delay(20);return {response:{statusCode:200,headers:{},body:source}};}),destroy:vi.fn()};
 const handler=boundedAwsHandler(new AbortController().signal,{remaining:8},{timeoutMs:10,native:native as unknown as NodeHttpHandler});
 try{await expect(handler.handle(new HttpRequest({method:"GET",hostname:"s3.us-east-1.amazonaws.com"}))).rejects.toThrow("aws_response_unavailable");expect(source.destroyed).toBe(true);}
 finally{handler.destroy();source.destroy();}
});
