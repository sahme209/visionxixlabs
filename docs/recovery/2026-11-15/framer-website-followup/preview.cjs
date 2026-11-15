'use strict';
// Local read-only presentation fixture. No account/session/provider actions.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const source=process.argv[2];
if(!source||!/^\/private\/tmp\/axiom-framer-website-[A-Za-z0-9_]+\/source$/.test(source))throw Error('fixed_owned_source_required');
const root=fs.realpathSync(source);if(root!==source)throw Error('unexpected_root');
const next=require(path.join(root,'node_modules/next'));
const app=next({dev:false,dir:root,hostname:'127.0.0.1',port:0});
const routes=new Set(['/','/integrations','/demo','/product','/auth/signin','/docs/integration-setup','/docs/permissions-model']);
let server,closing=false;
async function close(){if(closing)return;closing=true;clearTimeout(deadline);if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}await app.close();process.exit(0)}
const deadline=setTimeout(close,1200000);process.on('SIGINT',close);process.on('SIGTERM',close);process.on('SIGHUP',close);
(async()=>{await app.prepare();const handle=app.getRequestHandler();server=http.createServer((req,res)=>{
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end('Read-only fixture')}
 let uri;try{uri=new URL(req.url,'http://127.0.0.1')}catch{res.writeHead(400);return res.end()}
 delete req.headers.cookie;delete req.headers.authorization;
 if(uri.pathname==='/api/auth/providers'){
  const providers=Object.fromEntries(['google','github','cognito'].map(id=>[id,{id,name:id==='google'?'Google':id==='github'?'GitHub':'Cognito',type:'oauth',signinUrl:'/fixture-blocked',callbackUrl:'/fixture-blocked'}]));
  res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end(JSON.stringify(providers));
 }
 if(uri.pathname==='/api/auth/session'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end('{}')}
 const asset=['/_next/','/images/','/logos/','/brands/','/brand/','/fonts/'].some(prefix=>uri.pathname.startsWith(prefix))||uri.pathname==='/favicon.ico';
 if(!routes.has(uri.pathname)&&!asset){res.writeHead(403);return res.end('Outside local presentation review')}
 return handle(req,res);
 });server.listen(0,'127.0.0.1',()=>{const port=server.address().port;process.env.NEXTAUTH_URL=`http://127.0.0.1:${port}`;fs.writeFileSync(path.join(root,'../PREVIEW.json'),JSON.stringify({port,scope:'synthetic provider-list presentation only; no live sign-in'}));console.log(JSON.stringify({port}))})})().catch(error=>{console.error(error.name);process.exitCode=1;close()});
