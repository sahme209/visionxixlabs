import {it,expect,vi,beforeEach,afterEach} from 'vitest';
import {EventEmitter} from 'node:events';
import {sendCustomerHostedCompletion} from '../customerHostedTransport';
import {parseCustomerHostedOperatorConfig} from '../customerHostedConfig';
beforeEach(()=>{vi.stubEnv('AXIOM_OFFLINE_MODE','true')});
afterEach(()=>{vi.unstubAllEnvs()});
function config(kind='vllm'){
 return parseCustomerHostedOperatorConfig(JSON.stringify({format:'axiom.customer-hosted/1',installationId:'one',revision:'one',server:{kind,baseUrl:'https://models.private.test/v1',allowedHosts:['models.private.test']},models:[{id:'local',maxInputTokens:100,maxOutputTokens:20,maxInputBytes:8192}],budgets:[{organizationId:'org',windowId:'w',startsAt:'2026-11-11T00:00:00.000Z',expiresAt:'2026-11-12T00:00:00.000Z',limitTokens:10000}]}))!;
}
function fixture(change:{addresses?:string[];peer?:string;status?:number;body?:string}={}){
 let opts:any,body:string|undefined;const response=Object.assign(new EventEmitter(),{statusCode:change.status??200,headers:{'content-type':'application/json'},destroy:vi.fn()});
 const request=Object.assign(new EventEmitter(),{destroy:vi.fn(),end:vi.fn((b:Buffer)=>{body=b.toString();queueMicrotask(()=>{request.emit('response',response);response.emit('data',Buffer.from(change.body??JSON.stringify({model:'local',choices:[{index:0,finish_reason:'stop',message:{role:'assistant',content:'{"ok":true}'}}],usage:{prompt_tokens:5,completion_tokens:5,total_tokens:10}})));response.emit('end')})})});
 const socket=Object.assign(new EventEmitter(),{remoteAddress:change.peer??'10.1.2.3',authorized:true});
 const deps={resolve:vi.fn(async()=> (change.addresses??['10.1.2.3']).map(address=>({address,family:4}))),request:vi.fn((options:any)=>{opts=options;queueMicrotask(()=>{request.emit('socket',socket);socket.emit('secureConnect')});return request as any})};
 const beforeSend=vi.fn(async()=>{}),signal=new AbortController();
 return {deps,request,response,beforeSend,signal,options:()=>opts,body:()=>body};
}
it.each(['vllm','ollama','lm_studio'])('sends exactly one bounded %s request to its pinned peer',async kind=>{
 const f=fixture();const result=await sendCustomerHostedCompletion({config:config(kind),modelId:'local',prompt:'redacted input',signal:f.signal.signal,beforeSend:f.beforeSend},f.deps);
 expect(result.data).toEqual({ok:true});expect(f.deps.request).toHaveBeenCalledTimes(1);expect(f.request.end).toHaveBeenCalledTimes(1);expect(f.beforeSend).toHaveBeenCalledTimes(1);
 expect(f.options()).toMatchObject({hostname:'10.1.2.3',servername:'models.private.test',path:'/v1/chat/completions',method:'POST',agent:false,rejectUnauthorized:true});
 expect(JSON.parse(f.body()!)).toMatchObject({model:'local',max_tokens:20,stream:false,messages:[{role:'user',content:'redacted input'}]});
});
it('refuses mixed public DNS answers before constructing a request',async()=>{
 const f=fixture({addresses:['10.1.2.3','8.8.8.8']});await expect(sendCustomerHostedCompletion({config:config(),modelId:'local',prompt:'x',signal:f.signal.signal,beforeSend:f.beforeSend},f.deps)).rejects.toThrow();expect(f.deps.request).not.toHaveBeenCalled();
});
it('does not send a prompt to a mismatched actual socket peer',async()=>{
 const f=fixture({peer:'10.9.9.9'});await expect(sendCustomerHostedCompletion({config:config(),modelId:'local',prompt:'x',signal:f.signal.signal,beforeSend:f.beforeSend},f.deps)).rejects.toThrow();expect(f.request.end).not.toHaveBeenCalled();expect(f.beforeSend).not.toHaveBeenCalled();
});
it('refuses redirect responses without a second request',async()=>{
 const f=fixture({status:302});await expect(sendCustomerHostedCompletion({config:config(),modelId:'local',prompt:'x',signal:f.signal.signal,beforeSend:f.beforeSend},f.deps)).rejects.toThrow();expect(f.deps.request).toHaveBeenCalledTimes(1);
});
it('honors abort before resolution and after awaited admission',async()=>{
 const f=fixture();f.signal.abort();await expect(sendCustomerHostedCompletion({config:config(),modelId:'local',prompt:'x',signal:f.signal.signal,beforeSend:f.beforeSend},f.deps)).rejects.toThrow();expect(f.deps.resolve).not.toHaveBeenCalled();
 const g=fixture();g.beforeSend.mockImplementation(async()=>{g.signal.abort()});await expect(sendCustomerHostedCompletion({config:config(),modelId:'local',prompt:'x',signal:g.signal.signal,beforeSend:g.beforeSend},g.deps)).rejects.toThrow();expect(g.request.end).not.toHaveBeenCalled();
});
it('never sends after a refused final authority check',async()=>{
 const f=fixture();f.beforeSend.mockRejectedValue(Error('synthetic refusal'));await expect(sendCustomerHostedCompletion({config:config(),modelId:'local',prompt:'x',signal:f.signal.signal,beforeSend:f.beforeSend},f.deps)).rejects.toThrow();expect(f.request.end).not.toHaveBeenCalled();
});
it('expires during DNS and never sends when the late lookup finishes',async()=>{
 vi.useFakeTimers();
 try{
  const f=fixture();let release!:(v:{address:string;family:number}[])=>void;
  f.deps.resolve.mockImplementation(()=>new Promise(resolve=>{release=resolve}));
  const pending=sendCustomerHostedCompletion({config:config(),modelId:'local',prompt:'x',signal:f.signal.signal,beforeSend:f.beforeSend},f.deps);
  const rejected=expect(pending).rejects.toThrow('customer_hosted_transport_unavailable');
  await vi.advanceTimersByTimeAsync(10001);await rejected;
  release([{address:'10.1.2.3',family:4}]);await Promise.resolve();expect(f.deps.request).not.toHaveBeenCalled();
 }finally{vi.useRealTimers()}
});
it('rejects excessive bodies and malformed completions without replay',async()=>{
 for(const body of ['x'.repeat(1048577),'{"model":"local"}']){
  const f=fixture({body});await expect(sendCustomerHostedCompletion({config:config(),modelId:'local',prompt:'x',signal:f.signal.signal,beforeSend:f.beforeSend},f.deps)).rejects.toThrow();expect(f.deps.request).toHaveBeenCalledTimes(1);expect(f.request.end).toHaveBeenCalledTimes(1);
 }
});
it('refuses oversized input before DNS and sanitizes final-check errors',async()=>{
 const f=fixture();await expect(sendCustomerHostedCompletion({config:config(),modelId:'local',prompt:'x'.repeat(8193),signal:f.signal.signal,beforeSend:f.beforeSend},f.deps)).rejects.toThrow();expect(f.deps.resolve).not.toHaveBeenCalled();
 const g=fixture();g.beforeSend.mockRejectedValue(Object.assign(Error('private input must not appear'),{name:'CustomerHostedResponseError'}));
 await expect(sendCustomerHostedCompletion({config:config(),modelId:'local',prompt:'x',signal:g.signal.signal,beforeSend:g.beforeSend},g.deps)).rejects.toThrow('customer_hosted_transport_unavailable');
});
it('refuses non-loopback DNS answers for loopback HTTP configuration',async()=>{
 const c=config();const local=parseCustomerHostedOperatorConfig(JSON.stringify({format:c.format,installationId:c.installationId,revision:c.revision,server:{...c.server,baseUrl:'http://localhost:8000/v1',allowedHosts:['localhost']},models:c.models,budgets:c.budgets}))!;
 const f=fixture();await expect(sendCustomerHostedCompletion({config:local,modelId:'local',prompt:'x',signal:f.signal.signal,beforeSend:f.beforeSend},f.deps)).rejects.toThrow();expect(f.deps.request).not.toHaveBeenCalled();
});
it.each(['false','invalid',''])('refuses customer-hosted transport before DNS in mode %s',async mode=>{
 vi.stubEnv('AXIOM_OFFLINE_MODE',mode);const f=fixture();
 await expect(sendCustomerHostedCompletion({config:config(),modelId:'local',prompt:'x',signal:f.signal.signal,beforeSend:f.beforeSend},f.deps)).rejects.toThrow();expect(f.deps.resolve).not.toHaveBeenCalled();expect(f.deps.request).not.toHaveBeenCalled();
});
it('rechecks offline mode after DNS and after awaited final admission',async()=>{
 const f=fixture();f.deps.resolve.mockImplementation(async()=>{vi.stubEnv('AXIOM_OFFLINE_MODE','false');return [{address:'10.1.2.3',family:4}]});
 await expect(sendCustomerHostedCompletion({config:config(),modelId:'local',prompt:'x',signal:f.signal.signal,beforeSend:f.beforeSend},f.deps)).rejects.toThrow();expect(f.deps.request).not.toHaveBeenCalled();
 vi.stubEnv('AXIOM_OFFLINE_MODE','true');const g=fixture();g.beforeSend.mockImplementation(async()=>{vi.stubEnv('AXIOM_OFFLINE_MODE','false')});
 await expect(sendCustomerHostedCompletion({config:config(),modelId:'local',prompt:'x',signal:g.signal.signal,beforeSend:g.beforeSend},g.deps)).rejects.toThrow();expect(g.request.end).not.toHaveBeenCalled();
});
it('refuses all provider IO in the existing isolated application lane before DNS or admission',async()=>{
 vi.stubEnv('AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME','1');const f=fixture();
 await expect(sendCustomerHostedCompletion({config:config(),modelId:'local',prompt:'x',signal:f.signal.signal,beforeSend:f.beforeSend},f.deps)).rejects.toThrow();
 expect(f.deps.resolve).not.toHaveBeenCalled();expect(f.deps.request).not.toHaveBeenCalled();expect(f.beforeSend).not.toHaveBeenCalled();
});
it('cancels and drains delayed final admission on timeout instead of allowing a late claim',async()=>{
 vi.useFakeTimers();
 try{
  const f=fixture();let release!:()=>void,claims=0,entered=false;
  f.beforeSend.mockImplementation(async(terminalSignal?:AbortSignal)=>{entered=true;await new Promise<void>(r=>{release=r});terminalSignal?.throwIfAborted();claims++});
  const pending=sendCustomerHostedCompletion({config:config(),modelId:'local',prompt:'x',signal:f.signal.signal,beforeSend:f.beforeSend},f.deps);
  const rejected=expect(pending).rejects.toThrow();await vi.advanceTimersByTimeAsync(0);expect(entered).toBe(true);
  await vi.advanceTimersByTimeAsync(10001);release();await rejected;await vi.advanceTimersByTimeAsync(0);
  expect(claims).toBe(0);expect(f.request.end).not.toHaveBeenCalled();
 }finally{vi.useRealTimers()}
});
it('rejects an unsolicited response before the admitted body send and cancels admission',async()=>{
 const f=fixture();let release!:()=>void,entered!:()=>void,claims=0;
 const started=new Promise<void>(r=>{entered=r});
 f.beforeSend.mockImplementation(async(terminalSignal?:AbortSignal)=>{entered();await new Promise<void>(r=>{release=r});terminalSignal?.throwIfAborted();claims++});
 const pending=sendCustomerHostedCompletion({config:config(),modelId:'local',prompt:'x',signal:f.signal.signal,beforeSend:f.beforeSend},f.deps);const rejected=expect(pending).rejects.toThrow();await started;
 f.request.emit('response',f.response);f.response.emit('data',Buffer.from(JSON.stringify({model:'local',choices:[{index:0,finish_reason:'stop',message:{role:'assistant',content:'{}'}}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}})));f.response.emit('end');
 release();await rejected;expect(claims).toBe(0);expect(f.request.end).not.toHaveBeenCalled();
});
