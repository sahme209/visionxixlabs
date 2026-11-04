from pathlib import Path
import json,subprocess,sys
p=Path('work/agent-child-bindings');c=json.loads((p/'coordinates.json').read_text());o=Path(c['owned'])
env={'PATH':'/usr/bin:/bin','HOME':str(o/'home'),'TMPDIR':str(o/'tmp'),'XDG_CACHE_HOME':str(o/'cache'),'NODE_DISABLE_COMPILE_CACHE':'1'}
r=subprocess.run(['/usr/bin/sandbox-exec','-f',str(o/'test.sb'),'/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node','--test','docs/product/knowledge/agent-child-bindings.test.cjs'],env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=60)
(p/(sys.argv[1]+'.log')).write_bytes(r.stdout);(p/(sys.argv[1]+'-exit.txt')).write_text(str(r.returncode)+'\n');print(r.stdout.decode());print('EXIT',r.returncode)
