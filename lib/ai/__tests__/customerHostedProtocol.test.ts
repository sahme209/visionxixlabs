import {it,expect} from 'vitest';
import {customerHostedPrivateAddress,parseCustomerHostedCompletion} from '../customerHostedProtocol';
it('accepts only explicit loopback, RFC1918 and IPv6 ULA destinations',()=>{
 for(const ip of ['127.0.0.1','10.2.3.4','172.16.0.1','172.31.255.255','192.168.1.2','::1','fd12:3456::1'])expect(customerHostedPrivateAddress(ip)).toBe(true);
 for(const ip of ['8.8.8.8','172.32.0.1','192.169.1.1','169.254.169.254','0.0.0.0','224.0.0.1','fe80::1','2001:4860:4860::8888','::','::ffff:127.0.0.1','127.0.0.1.evil','localhost','10.0.0.1%eth0'])expect(customerHostedPrivateAddress(ip)).toBe(false);
});
const response=()=>({model:'team/model:1',choices:[{index:0,finish_reason:'stop',message:{role:'assistant',content:'{"value":"ok"}'}}],usage:{prompt_tokens:50,completion_tokens:10,total_tokens:60}});
it('extracts one exact-model structured result and integer usage',()=>{
 expect(parseCustomerHostedCompletion(JSON.stringify(response()),'team/model:1',100,20)).toEqual({data:{value:'ok'},raw:'{"value":"ok"}',promptTokens:50,completionTokens:10,totalTokens:60});
});
it('refuses missing, inconsistent, excessive, fractional and truncated output usage',()=>{
 for(const mutate of [(v:any)=>delete v.usage,(v:any)=>v.usage.total_tokens=59,(v:any)=>v.usage.prompt_tokens=101,(v:any)=>v.usage.completion_tokens=21,(v:any)=>v.usage.completion_tokens=0.5,(v:any)=>v.choices[0].finish_reason='length',(v:any)=>v.model='other',(v:any)=>v.choices.push(v.choices[0]),(v:any)=>v.choices[0].message.tool_calls=[{id:'tool'}],(v:any)=>v.choices[0].message.content='not json']){
  const v=response();mutate(v);expect(()=>parseCustomerHostedCompletion(JSON.stringify(v),'team/model:1',100,20)).toThrow('customer_hosted_response_unverified');
 }
});
it('rejects invalid UTF8 and overlong response bodies without exposing their content',()=>{
 expect(()=>parseCustomerHostedCompletion(Buffer.from([0xff]),'team/model:1',100,20)).toThrow('customer_hosted_response_unverified');
 expect(()=>parseCustomerHostedCompletion('x'.repeat(1048577),'team/model:1',100,20)).toThrow('customer_hosted_response_unverified');
});
it('preserves larger reported liability when refusing an overrun or inconsistent usage',()=>{
 for(const reported of [{prompt_tokens:50,completion_tokens:150,total_tokens:200},{prompt_tokens:50,completion_tokens:10,total_tokens:500}]){
  const v=response();v.usage=reported;
  try{parseCustomerHostedCompletion(JSON.stringify(v),'team/model:1',100,20);throw Error('unexpected acceptance')}catch(error){
   expect(error).toMatchObject({message:'customer_hosted_response_unverified',usage:{totalTokens:reported.total_tokens}});
  }
 }
});
it('refuses expanded IPv4-mapped IPv6 aliases as destinations',()=>{
 expect(customerHostedPrivateAddress('0:0:0:0:0:ffff:7f00:1')).toBe(false);
});
