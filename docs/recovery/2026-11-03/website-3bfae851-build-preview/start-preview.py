import os,json
from pathlib import Path
coords=json.loads(Path('/private/tmp/axiom-website-3bfae851-coordinates.json').read_text()); stage=Path(coords['owned'])/'stage'
node='/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node'
env={'PATH':str(Path(node).parent)+':/usr/bin:/bin:/usr/sbin:/sbin','LANG':'C','TZ':'UTC','NODE_ENV':'production','NEXT_TELEMETRY_DISABLED':'1','DATABASE_URL':'postgresql://local_build:local_build@127.0.0.1:1/local_build','AUTH_SECRET':'isolated-local-build-not-a-live-credential-20261102','NEXTAUTH_SECRET':'isolated-local-build-not-a-live-credential-20261102'}
profile='(version 1)(allow default)(deny network-outbound)(deny file-write*)'
os.chdir(stage)
print('PREVIEW_BACKEND source 3bfae851 host127.0.0.1 port5203 nooutbound nowrites',flush=True)
os.execve('/usr/bin/sandbox-exec',['sandbox-exec','-p',profile,node,'node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','5203'],env)
