// Fixed loopback static study only. No desktop JavaScript, writes or external requests.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const base=__dirname,root=path.resolve(base,'../../../..');
const receipt=JSON.parse(fs.readFileSync(path.join(base,'FRONTEND-RESULT.json')));
const crypto=require('node:crypto'),dist=path.join(receipt.output,'dist');
const cssNames=Object.keys(receipt.artifacts).filter(x=>x.endsWith('.css'));
if(cssNames.length!==1)throw Error('css_count');
const css=fs.readFileSync(path.join(dist,cssNames[0]));if(crypto.createHash('sha256').update(css).digest('hex')!==receipt.artifacts[cssNames[0]])throw Error('css_hash');
const capture=JSON.parse(fs.readFileSync(path.join(root,'work/desktop-exact-composition/SOURCE-MARKUP.json')));
if(!capture.frames.settings.includes('7.8.9'))throw Error('version_not_settled');
const {documentFor}=require('../desktop-exact-composition-validation/desktop-study.cjs');
const files=new Map([['/__desktop-study/styles.css',[css,'text/css; charset=utf-8']]]);
for(const name of ['axiom-logo.png','brand/vxix-wordmark.svg','brand/vxix-mark.svg','images/axiom-painted-basin.webp']){
 const body=fs.readFileSync(path.join(root,'desktop/public',name));files.set('/'+name,[body,name.endsWith('.svg')?'image/svg+xml':name.endsWith('.webp')?'image/webp':'image/png']);
}
const server=http.createServer((req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return}
 let u;try{u=new URL(req.url,'http://127.0.0.1')}catch{res.writeHead(400);res.end();return}
 let item;
 if(u.pathname==='/settings'&&[...u.searchParams.keys()].every(k=>k==='theme')&&u.searchParams.getAll('theme').length<=1&&['dark','light'].includes(u.searchParams.get('theme')||'dark'))item=[Buffer.from(documentFor(capture.frames.settings,u.searchParams.get('theme')||'dark')),'text/html; charset=utf-8'];
 else if(!u.search)item=files.get(u.pathname);
 if(!item){res.writeHead(404);res.end();return}
 res.writeHead(200,{'Content-Type':item[1],'Content-Length':item[0].length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"});res.end(req.method==='HEAD'?undefined:item[0]);
});
const timer=setTimeout(()=>server.close(),480000);
for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>{clearTimeout(timer);server.close()});
server.listen(0,'127.0.0.1',()=>console.log(JSON.stringify({url:'http://127.0.0.1:'+server.address().port+'/settings',pid:process.pid,scope:'static synthetic layout only',automaticStopSeconds:480})));
server.on('close',()=>{clearTimeout(timer);console.log('owned_static_server_closed')});
