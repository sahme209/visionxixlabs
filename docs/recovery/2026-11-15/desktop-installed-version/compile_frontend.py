"""One local frontend compile; no native build, install, restart or deployment."""
from pathlib import Path
import hashlib,json,os,signal,subprocess,tempfile,time
ROOT=Path(__file__).resolve().parents[4]
NODE=Path('/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node')
OUT=Path(tempfile.mkdtemp(prefix='axiom-installed-version-frontend-'))
(OUT/'empty-env').mkdir();(OUT/'tmp').mkdir()
config=OUT/'vite.config.mjs'
config.write_text('import original from '+json.dumps(str(ROOT/'desktop/vite.config.ts'))+';\nexport default async env => ({...(await original(env)),root:'+json.dumps(str(ROOT/'desktop'))+',envDir:'+json.dumps(str(OUT/'empty-env'))+',cacheDir:'+json.dumps(str(OUT/'cache'))+',build:{outDir:'+json.dumps(str(OUT/'dist'))+',emptyOutDir:true}});\n')
profile=OUT/'network-deny.sb';profile.write_text('(version 1)\n(allow default)\n(deny network*)\n')
command=['/usr/bin/sandbox-exec','-f',str(profile),str(NODE),str(ROOT/'desktop/node_modules/vite/bin/vite.js'),'build','--configLoader','native','--config',str(config)]
# No inherited credentials or dotenv. Use only compiler-required nonsecret values.
env={'PATH':str(NODE.parent)+':/usr/bin:/bin','TMPDIR':str(OUT/'tmp'),'LANG':'en_US.UTF-8','CI':'true'}
log=ROOT/'docs/recovery/2026-11-15/desktop-installed-version/FRONTEND-BUILD.log'
receipt={'scope':'frontend compilation only; not rendered/native/installed acceptance','output':str(OUT),'network':'denied by sandbox-exec','dotenv':'owned empty envDir','nativeExecuted':False,'installedAppChanged':False,'timeoutSeconds':600}
with log.open('w') as stream:
 p=subprocess.Popen(command,cwd=ROOT/'desktop',env=env,stdout=stream,stderr=subprocess.STDOUT,start_new_session=True)
 try:receipt['exitCode']=p.wait(timeout=600)
 except subprocess.TimeoutExpired:
  os.killpg(p.pid,signal.SIGKILL);p.wait(timeout=5);receipt['exitCode']=None;receipt['timedOut']=True
receipt['artifacts']={str(p.relative_to(OUT/'dist')):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((OUT/'dist').rglob('*')) if p.is_file()} if (OUT/'dist').exists() else {}
(ROOT/'docs/recovery/2026-11-15/desktop-installed-version/FRONTEND-RESULT.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({k:v for k,v in receipt.items() if k!='artifacts'}))
raise SystemExit(0 if receipt['exitCode']==0 else 1)
