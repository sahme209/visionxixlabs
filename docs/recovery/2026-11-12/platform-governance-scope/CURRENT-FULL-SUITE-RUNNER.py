import os,json,subprocess,tempfile,signal,hashlib
from pathlib import Path
repo=Path('/Users/samirahmed/.codex/worktrees/axiom-aws-sdk-upgrade/axiom-ticket-install-completion');root=Path(tempfile.mkdtemp(prefix='axiom-current-full-suite-',dir='/private/tmp'));os.chmod(root,0o700)
for name in ['home','empty-env','cache']:(root/name).mkdir()
head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip();diff=subprocess.check_output(['git','diff','HEAD','--'],cwd=repo)
config='import base from '+json.dumps(str(repo/'vitest.config.ts'))+'; export default {...base,root:'+json.dumps(str(repo))+',envDir:'+json.dumps(str(root/'empty-env'))+',cacheDir:'+json.dumps(str(root/'cache'))+',test:{...base.test,maxWorkers:4}};\n';(root/'vitest.config.mts').write_text(config)
run={'head':head,'workingDiffSha256':hashlib.sha256(diff).hexdigest(),'scope':'full ordinary suite; clean environment/empty dotenv directory; no real provider or actual PG opt-in flags','maxWorkers':4,'productionChanged':False};(root/'run.json').write_text(json.dumps(run,indent=2))
node=Path('/Users/samirahmed/.nvm/versions/node/v24.21.0/bin');env={'PATH':str(node)+':/opt/homebrew/bin:/usr/bin:/bin','HOME':str(root/'home'),'TMPDIR':str(root),'LANG':'en_US.UTF-8','TZ':'UTC','NODE_ENV':'test','CI':'1','NEXT_TELEMETRY_DISABLED':'1'}
print(str(root),flush=True)
with (root/'run.log').open('wb') as log:
 p=subprocess.Popen([str(node/'node'),str(repo/'scripts/run-vitest.mjs'),'--config',str(root/'vitest.config.mts'),'--reporter=json','--outputFile='+str(root/'result.json')],cwd=repo,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
 try:code=p.wait(timeout=1800)
 except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait();code=124
run.update(exitCode=code,sourceUnchanged=subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip()==head and subprocess.check_output(['git','diff','HEAD','--'],cwd=repo)==diff)
(root/'completion.json').write_text(json.dumps(run,indent=2));print(json.dumps({'root':str(root),'exitCode':code}),flush=True)
raise SystemExit(code)
