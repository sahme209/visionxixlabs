// Node Server.listen calls dns.lookup even for a literal IPv4 host. Delegate
// exactly this literal to the original builtin; never synthesize an answer.
module.exports=function installLiteralLoopbackLookup(dns,refuse){
 const originalLookup=dns.lookup;
 for(const api of [dns,dns.promises])for(const key of Object.keys(api)){
  if(!/^(lookup|resolve|reverse)/.test(key)||typeof api[key]!=='function')continue;
  if(api===dns&&key==='lookup')api[key]=function(hostname,...args){
   if(hostname!=='127.0.0.1')return refuse();
   return Reflect.apply(originalLookup,dns,[hostname,...args]);
  };
  else api[key]=refuse;
 }
 require('node:module').syncBuiltinESMExports();
};
