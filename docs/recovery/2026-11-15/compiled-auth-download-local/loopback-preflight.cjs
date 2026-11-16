// Harmless short-lived empty HTTP listener. No database or application handler.
const assert=require('node:assert/strict'),http=require('node:http'),dns=require('node:dns');
const port=Number(process.argv[2]);assert(Number.isInteger(port)&&port>0&&port<=65535);
const original=dns.lookup;let legacyCalls=0,server;
const timer=setTimeout(()=>{server?.closeAllConnections();server?.close();console.error('owned_loopback_preflight_deadline');process.exit(1)},3000);
(async()=>{
 dns.lookup=function(host,..._args){assert.equal(host,'127.0.0.1');legacyCalls++;throw Error('legacy_literal_lookup_denied')};
 const legacy=http.createServer();assert.throws(()=>legacy.listen({host:'127.0.0.1',port,exclusive:true}),error=>error.message==='legacy_literal_lookup_denied');assert.equal(legacyCalls,1);assert.equal(legacy.listening,false);
 dns.lookup=original;
 const refuse=()=>{throw Error('owned_loopback_lookup_refused')};
 require('./literal-dns.cjs')(dns,refuse);
 server=http.createServer((_req,res)=>res.writeHead(403).end());
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen({host:'127.0.0.1',port,exclusive:true},resolve)});
 assert.equal(server.address().address,'127.0.0.1');assert.equal(server.address().port,port);
 for(const host of ['example.invalid','localhost','::1','127.0.0.2'])assert.throws(()=>dns.lookup(host,()=>{throw Error('unexpected_callback')}),/owned_loopback_lookup_refused/);
 assert.throws(()=>dns.promises.lookup('127.0.0.1'),/owned_loopback_lookup_refused/);
 assert.throws(()=>dns.resolve4('127.0.0.1',()=>undefined),/owned_loopback_lookup_refused/);
 assert.throws(()=>dns.reverse('127.0.0.1',()=>undefined),/owned_loopback_lookup_refused/);
 assert.throws(()=>dns.lookupService('127.0.0.1',port,()=>undefined),/owned_loopback_lookup_refused/);
 await new Promise(resolve=>server.close(resolve));assert.equal(server.listening,false);
 console.log(JSON.stringify({accepted:true,legacyLiteralLookupDenialReproduced:true,originalBuiltinDelegated:true,actualLiteralLoopbackBind:true,externalDnsRefused:true,promisesResolveReverseAndOtherLookupRefused:true,listenerClosed:true,databaseOrApplicationStarted:false}));
})().catch(()=>{console.error('owned_loopback_preflight_failed');process.exitCode=1}).finally(()=>{clearTimeout(timer);if(server?.listening){server.closeAllConnections();server.close(()=>process.exit(1))}});
