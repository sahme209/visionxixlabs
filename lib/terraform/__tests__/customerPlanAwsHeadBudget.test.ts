import { IncomingMessage } from "node:http";
import { Socket } from "node:net";
import { HttpRequest } from "@smithy/protocol-http";
import type { NodeHttpHandler } from "@smithy/node-http-handler";
import { expect, it, vi } from "vitest";
import { boundedAwsHandler } from "@/lib/cloud/aws/ecsObservation/boundedAwsHandler";
function fixture({method="HEAD",length="1024",data="",remaining=8,optIn=true,maxBytes=1024}:{method?:string;length?:string;data?:string;remaining?:number;optIn?:boolean;maxBytes?:number}={}){
 const body=new IncomingMessage(new Socket());body.push(Buffer.from(data));body.push(null);
 const native={handle:vi.fn(async()=>({response:{statusCode:200,headers:{"content-length":length},body}})),destroy:vi.fn()};
 const budget={remaining};const handler=boundedAwsHandler(new AbortController().signal,budget,{maxBytes,headObjectMetadata:optIn,native:native as unknown as NodeHttpHandler});
 return {handler,budget,native,request:new HttpRequest({method,hostname:"s3.us-east-1.amazonaws.com",path:"/owned/key"})};
}
it("treats only opted-in HEAD length as bounded object metadata, not received body bytes",async()=>{
 const f=fixture();try{const result=await f.handler.handle(f.request);expect(result.response.headers["content-length"]).toBe("1024");expect(f.budget.remaining).toBe(8);}finally{f.handler.destroy();}
});
it("rejects every observed nonempty HEAD body before returning headers as usable evidence",async()=>{
 const f=fixture({length:"1",data:"x"});try{await expect(f.handler.handle(f.request)).rejects.toThrow("aws_response_unavailable");}finally{f.handler.destroy();}
});
it.each(["-1","NaN","1.5","1025"])("rejects malformed or oversized HEAD declaration %s",async length=>{
 const f=fixture({length});try{await expect(f.handler.handle(f.request)).rejects.toThrow("aws_response_unavailable");}finally{f.handler.destroy();}
});
it("requires a positive response budget even for empty HEAD metadata",async()=>{
 const f=fixture({remaining:0});try{await expect(f.handler.handle(f.request)).rejects.toThrow();expect(f.native.handle).not.toHaveBeenCalled();}finally{f.handler.destroy();}
});
it.each([{method:"GET",optIn:true},{method:"GET",optIn:false},{method:"HEAD",optIn:false}])("preserves ordinary declared-body budget refusal for %j",async options=>{
 const f=fixture(options);try{await expect(f.handler.handle(f.request)).rejects.toThrow("aws_response_unavailable");}finally{f.handler.destroy();}
});
it.each([Number.NaN,Number.POSITIVE_INFINITY,1.5])("rejects an invalid HEAD remaining budget %s before native transport",async remaining=>{
 const f=fixture({remaining});try{await expect(f.handler.handle(f.request)).rejects.toThrow("aws_response_unavailable");expect(f.native.handle).not.toHaveBeenCalled();}finally{f.handler.destroy();}
});
it("keeps HEAD metadata unavailable until the empty stream completes and bounds a stalled body",async()=>{
 const body=new IncomingMessage(new Socket());
 const native={handle:vi.fn(async()=>({response:{statusCode:200,headers:{"content-length":"8"},body}})),destroy:vi.fn()};
 const handler=boundedAwsHandler(new AbortController().signal,{remaining:8},{headObjectMetadata:true,timeoutMs:10,native:native as unknown as NodeHttpHandler});
 try{
  await expect(handler.handle(new HttpRequest({method:"HEAD",hostname:"s3.us-east-1.amazonaws.com"}))).rejects.toThrow("aws_response_unavailable");
  expect(body.destroyed).toBe(true);
 }finally{handler.destroy();}
});
