import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
const guardPath = fileURLToPath(new URL("../../scripts/fixtures/ownedEcsCheckedInputPreload.cjs", import.meta.url));
function noSend(code: string) {
  const result = spawnSync(process.execPath, ["-e", `const assert=require('node:assert/strict'); const http=require('node:http'),https=require('node:https'),dns=require('node:dns'),udp=require('node:dgram'),net=require('node:net'); void process.stdout;void process.stderr;void process.stdin;let sends=0,nativeSends=0;const canary=()=>{nativeSends++;throw Error('no_send_native_canary')};const cares=process.binding('cares_wrap');cares.getaddrinfo=cares.getnameinfo=canary;for(const key of Object.getOwnPropertyNames(cares.ChannelWrap.prototype))if(key.startsWith('query')||key==='getHostByAddr')cares.ChannelWrap.prototype[key]=canary;for(const [binding,names]of [['udp_wrap',['send','send6','bind','bind6','connect','connect6','open']],['tcp_wrap',['connect','connect6','open','bind','bind6','listen']],['pipe_wrap',['connect','open','bind','listen']]]){const object=process.binding(binding)[binding==='udp_wrap'?'UDP':binding==='tcp_wrap'?'TCP':'Pipe'].prototype;for(const name of names)object[name]=canary}process.on('exit',()=>{if(nativeSends)process.exitCode=2});http.request=()=>{sends++;throw Error('underlying_delegate_must_not_send')}; const {installOwnedEcsCheckedInputGuard}=require(${JSON.stringify(guardPath)}); ${code}`], { env: { PATH: process.env.PATH ?? "/usr/bin:/bin" }, encoding: "utf8", timeout: 5000, maxBuffer: 16384 });
  expect(result.status, result.stderr).toBe(0); expect(result.stdout.trim()).toBe("no_send_pass");
}
it("denies captured DNS/Resolver/UDP and socket references before native sends", () => noSend(`
 const lookup=dns.lookup, resolve=dns.resolve4, resolver=new dns.Resolver(), resolverCall=resolver.resolve4.bind(resolver), createSocket=udp.createSocket,rawUdp=createSocket('udp4'),send=rawUdp.send.bind(rawUdp), socket=new net.Socket(), connect=socket.connect.bind(socket);
 const g=installOwnedEcsCheckedInputGuard({origin:'http://127.0.0.1:34567',proof:'a'.repeat(32)});
 for(const call of [()=>lookup('example.com',()=>{}),()=>resolve('example.com',()=>{}),()=>resolverCall('example.com',()=>{}),()=>createSocket('udp4').send('x',53,'1.1.1.1',()=>{}),()=>send('x',53,'1.1.1.1',()=>{})]) assert.throws(call,/owned_ecs_egress_denied/);
 socket.once('error',error=>{assert.equal(error.code,'EPERM');assert.equal(sends,0);require('node:fs').writeSync(1,'no_send_pass')});connect(443,'1.1.1.1');
`));
it("denies unsafe HTTP(S), custom agents and credential forwarding before delegation", () => noSend(`
 const g=installOwnedEcsCheckedInputGuard({origin:'http://127.0.0.1:34567',proof:'a'.repeat(32)});
 for(const args of [ ['https://sts.us-east-1.amazonaws.com/',{method:'GET'}], ['https://ecs.us-west-2.amazonaws.com/',{method:'POST'}], ['https://ecs.us-east-1.amazonaws.com/not-root',{method:'POST'}], ['https://ecs.us-east-1.amazonaws.com/',{method:'POST',createConnection(){}}], ['https://ecs.us-east-1.amazonaws.com/',{method:'POST',agent:{addRequest(){}}}], ['https://user:secret@ecs.us-east-1.amazonaws.com/',{method:'POST'}], ['http://127.0.0.1:34567/',{method:'POST'}]]) assert.throws(()=>https.request(...args),/owned_ecs_egress_denied/);
 assert.equal(sends,0); require('node:fs').writeSync(1,'no_send_pass');
`));
it("denies native fetch dispatcher/redirect/header bypasses and direct Undici dispatch without sends", () => noSend(`
 const oldFetch=globalThis.fetch; const g=installOwnedEcsCheckedInputGuard({origin:'http://127.0.0.1:34567',proof:'a'.repeat(32)});
 (async()=>{
 const base={method:'GET',credentials:'omit',redirect:'error',headers:{Authorization:'Bearer synthetic'}};
 for(const [url,init] of [ ['https://api.github.com/repos/github/artifact-attestations-workflows',{...base,dispatcher:{dispatch(){}}}], ['https://api.github.com/repos/github/artifact-attestations-workflows',{...base,redirect:'follow'}], ['https://owned-ecs-bundle.invalid/attestations/804468129/bundle.json',base], ['https://api.github.com/unknown',base], ['http://127.0.0.1:34567/',base]]) await assert.rejects(()=>fetch(url,init),/owned_ecs_egress_denied/);
 await assert.rejects(()=>oldFetch('https://api.github.com/repos/github/artifact-attestations-workflows',base));
 const d=globalThis[Symbol.for('undici.globalDispatcher.1')]; assert.throws(()=>d.dispatch({origin:'https://example.com',path:'/'},{}),/owned_ecs_egress_denied/);
 assert.throws(()=>Object.defineProperty(globalThis,Symbol.for('undici.globalDispatcher.2'),{value:{dispatch(){}}}),TypeError);
 assert.equal(sends,0);require('node:fs').writeSync(1,'no_send_pass');
 })().catch(()=>{process.exitCode=1});
`));
it("denies captured promise resolvers, direct native fetch with dispatcher and captured Undici Agent", () => {
  const undiciPath = fileURLToPath(new URL("../../node_modules/undici/index.js", import.meta.url));
  noSend(`
  const undici=require(${JSON.stringify(undiciPath)}), agent=new undici.Agent(), capturedLookup=dns.promises.lookup, resolver=new dns.promises.Resolver(), capturedResolve=resolver.resolveAny.bind(resolver), originalFetch=fetch;
  installOwnedEcsCheckedInputGuard({origin:'http://127.0.0.1:34567',proof:'a'.repeat(32)});
  (async()=>{
   await assert.rejects(()=>capturedLookup('example.com'));await assert.rejects(()=>capturedResolve('example.com'));
   await assert.rejects(()=>originalFetch('https://example.com/',{dispatcher:agent}));
   await assert.rejects(()=>agent.request({origin:'http://127.0.0.1:34567',method:'GET',path:'/'}));
   await agent.destroy();assert.equal(sends,0);require('node:fs').writeSync(1,'no_send_pass');
  })().catch(()=>{process.exitCode=1});
 `);
});
it("maps only a signed fixed AWS request and never delegates a caller routing agent", () => noSend(`
 const events=require('node:events');let routed;
 http.request=options=>{sends++;routed=options;return new events.EventEmitter()};
 const g=installOwnedEcsCheckedInputGuard({origin:'http://127.0.0.1:34567',proof:'a'.repeat(32)});
 https.request({protocol:'https:',hostname:'ecs.us-east-1.amazonaws.com',method:'POST',path:'/',headers:{host:'ecs.us-east-1.amazonaws.com',authorization:'AWS4-HMAC-SHA256 Credential=ASIAOWNED0001/20261018/us-east-1/ecs/aws4_request, SignedHeaders=host, Signature=synthetic'},agent:new https.Agent({keepAlive:true})});
 assert.equal(sends,1);assert.equal(routed.hostname,'127.0.0.1');assert.equal(routed.port,34567);assert.equal(routed.agent,false);assert.equal(routed.headers['x-axiom-original-host'],'ecs.us-east-1.amazonaws.com');assert.equal(routed.headers.host,'ecs.us-east-1.amazonaws.com');require('node:fs').writeSync(1,'no_send_pass');
`));
it("validates exact fetch paths/credentials and privately routes without a network send", () => noSend(`
 let routed;globalThis.fetch=async(url,init)=>{sends++;routed={url,init};return new Response('owned')};
 installOwnedEcsCheckedInputGuard({origin:'http://127.0.0.1:34567',proof:'a'.repeat(32)});
 (async()=>{
 await fetch('https://owned-ecs-bundle.invalid/attestations/804468129/bundle.json',{method:'GET',headers:{Accept:'application/json'},credentials:'omit',redirect:'error'});
 assert.equal(sends,1);assert.equal(routed.url,'http://127.0.0.1:34567/attestations/804468129/bundle.json');assert.equal(routed.init.headers.authorization,undefined);assert.ok(routed.init.dispatcher);
 for(const h of [{Authorization:'Bearer cannot-export'},{cookie:'x'},{'x-amz-security-token':'cannot-export'},{'x-goog-api-key':'cannot-export'},{host:'other.invalid'},{'x-axiom-fixture-guard':'forged'}]) await assert.rejects(()=>fetch('https://owned-ecs-bundle.invalid/attestations/804468129/bundle.json',{method:'GET',headers:h,credentials:'omit',redirect:'error'}),/owned_ecs_egress_denied/);
 assert.equal(sends,1);require('node:fs').writeSync(1,'no_send_pass');
 })().catch(()=>{process.exitCode=1});
`));
it("closes HTTP, get, raw sockets, TLS, HTTP2 and new UDP builtin entrypoints", () => noSend(`
 const tls=require('node:tls'),http2=require('node:http2');
 installOwnedEcsCheckedInputGuard({origin:'http://127.0.0.1:34567',proof:'a'.repeat(32)});
 for(const call of [()=>http.request('http://example.com'),()=>http.get('http://127.0.0.1:34567'),()=>https.get('https://ecs.us-east-1.amazonaws.com/'),()=>net.connect(34567,'127.0.0.1'),()=>net.createConnection({host:'::1',port:34567}),()=>new net.Socket().connect('/tmp/not-owned.sock'),()=>tls.connect({host:'example.com',port:443}),()=>http2.connect('https://example.com'),()=>udp.createSocket('udp4'),()=>dns.lookupService('127.0.0.1',80,()=>{})])assert.throws(call,/owned_ecs_egress_denied/);
 assert.equal(sends,0);require('node:fs').writeSync(1,'no_send_pass');
`));
it("rejects routing/TLS overrides with otherwise valid signed headers", () => noSend(`
 const g=installOwnedEcsCheckedInputGuard({origin:'http://127.0.0.1:34567',proof:'a'.repeat(32)});
 const signed={protocol:'https:',hostname:'ecs.us-east-1.amazonaws.com',method:'POST',path:'/',headers:{host:'ecs.us-east-1.amazonaws.com',authorization:'AWS4-HMAC-SHA256 Credential=ASIAOWNED0001/date/service/signature'}};
 for(const change of [{rejectUnauthorized:false},{lookup(){}},{createConnection(){}},{socketPath:'/tmp/other'},{_defaultAgent:{addRequest(){}}},{agent:{addRequest(){}}},{host:'other.invalid'},{port:80},{hostname:'ECS.us-east-1.amazonaws.com'}])assert.throws(()=>https.request({...signed,...change}),/owned_ecs_egress_denied/);
 const a=new https.Agent();a.createConnection=()=>{throw Error('must_not_run')};assert.throws(()=>https.request({...signed,agent:a}),/owned_ecs_egress_denied/);
 assert.equal(sends,0);require('node:fs').writeSync(1,'no_send_pass');
`));
