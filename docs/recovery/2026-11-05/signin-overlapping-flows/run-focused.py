from pathlib import Path
import json,subprocess,base64,time,sys
r=Path(__file__).resolve().parents[4];e=Path(__file__).parent;o=Path(json.loads((e/'coordinates.json').read_text())['owned'])
label=sys.argv[1]
if label not in ['red','green','compatibility']:raise SystemExit('fixed_label_required')
config=o/('compatibility.config.mjs' if label=='compatibility' else 'vitest.config.mjs')
cmd=['/usr/bin/sandbox-exec','-f',str(o/'test.sb'),'/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node','--no-experimental-webstorage',str(r/'node_modules/vitest/vitest.mjs'),'run','--config',str(config),'--configLoader','native']
t=time.monotonic();p=subprocess.run(cmd,cwd=r,env={'HOME':str(o/'home'),'TMPDIR':str(o/'tmp'),'PATH':'/usr/bin:/bin','NODE_ENV':'test','CI':'1','TZ':'UTC'},capture_output=True,timeout=45)
(e/(label+'.json')).write_text(json.dumps({'command':cmd,'exitCode':p.returncode,'elapsedSeconds':time.monotonic()-t,'stdoutBase64':base64.b64encode(p.stdout).decode(),'stderrBase64':base64.b64encode(p.stderr).decode()},indent=2)+'\n');print(p.stdout.decode()[-2600:]);print(p.stderr.decode()[-1200:]);print('CHILD_EXIT',p.returncode)
