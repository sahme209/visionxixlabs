from pathlib import Path
import json,subprocess,time,os,signal,sys
repo=Path('/Users/samirahmed/Documents/Codex/2026-10-29/axiom-ticket-install-completion');r=repo/'docs/recovery/2026-11-04/docs-heading-search';o=Path(__file__).parent
cmd=['/usr/bin/sandbox-exec','-f',str(o/'test.sb'),'/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node','--no-experimental-webstorage',str(repo/'node_modules/vitest/vitest.mjs'),'run','--config',str(o/'docs-navigation.config.mjs'),'--configLoader','native']
env={'HOME':str(o/'home'),'TMPDIR':str(o/'tmp'),'PATH':'/usr/bin:/bin','CI':'1','NODE_ENV':'test','NODE_OPTIONS':'--no-experimental-webstorage','NO_COLOR':'1','TZ':'UTC'}
t=time.monotonic();p=subprocess.Popen(cmd,cwd=repo,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,start_new_session=True);expired=False
try:out,_=p.communicate(timeout=45)
except subprocess.TimeoutExpired:expired=True;os.killpg(p.pid,signal.SIGKILL);out,_=p.communicate()
(r/(sys.argv[1]+'.log')).write_text(out);(r/(sys.argv[1]+'.json')).write_text(json.dumps({'command':cmd,'exitCode':p.returncode,'timedOut':expired,'elapsedSeconds':round(time.monotonic()-t,3),'processReaped':True},indent=2)+'\n');print(out[-4000:]);print('exit',p.returncode)
