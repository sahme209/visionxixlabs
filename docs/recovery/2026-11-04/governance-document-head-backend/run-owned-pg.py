"""PREPARED ONLY. One fresh socket-only PG journey; no existing DB, generate, install or migration."""
import os,subprocess,tempfile,json,hashlib,re
from pathlib import Path
os.umask(0o077)
repo=Path('/private/tmp/axiom-a2-document-head-backend-20261104')
evidence=Path('/private/tmp/axiom-a2-document-head-evidence')
cache=Path('/private/tmp/axiom-provider-approval-pg-evidence-05k2bvm2')
node=Path('/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node')
deps=Path('/private/tmp/axiom-bootstrap-preparation-build-4087adb5-l0z31yy2/stage/node_modules')
bins=Path('/opt/homebrew/opt/postgresql@17/bin')
assert hashlib.sha256((cache/'schema.prisma').read_bytes()).hexdigest()=='af364d07be282a70caeef3333cc1cdeb732655808d92c7c27ef748392697fbaa'
assert hashlib.sha256((cache/'generated/index.js').read_bytes()).hexdigest()=='f6172bc055dd51ba2b388d0fce59861ac74d2c5bdb3f97eadd6d175c662ef482'
source=(repo/'prisma/schema.prisma').read_text();cached=(cache/'schema.prisma').read_text()
for name in ['DurableAgentWorkflow','DurableAgentWorkflowEvent']:
 assert re.search(r'^model '+name+r' \{.*?^\}',source,re.M|re.S).group()==re.search(r'^model '+name+r' \{.*?^\}',cached,re.M|re.S).group()
root=Path(tempfile.mkdtemp(prefix='axiom-ticket-governance-pg-',dir='/private/tmp')).resolve();socket=root/'socket';socket.mkdir(mode=0o700)
profile=evidence/'pg-deny.sb'
profile.write_text('(version 1)\n(allow default)\n(deny network* (remote ip "*:*"))\n'+''.join('(deny file-write* (subpath '+json.dumps(str(p))+'))\n' for p in [Path('/Users/samirahmed/Documents/Codex/2026-10-29/axiom-ticket-install-completion'),deps.parent.parent,cache]))
env={'PATH':str(node.parent)+':/usr/bin:/bin','HOME':str(evidence),'TMPDIR':str(evidence),'LANG':'C','TZ':'UTC','NODE_ENV':'test','PGHOST':str(socket),'PGUSER':'recovery_fixture','PGDATABASE':'neondb','DATABASE_URL':'postgresql://recovery_fixture@localhost/neondb?host='+str(socket).replace('/','%2F'),'PRISMA_GENERATE_SKIP_AUTOINSTALL':'true','CHECKPOINT_DISABLE':'1','PRISMA_HIDE_UPDATE_MESSAGE':'1','AXIOM_TICKET_GOVERNANCE_PG_SOCKET':str(socket),'AXIOM_TICKET_GOVERNANCE_PG_CLIENT':str(cache/'generated/index.js')}
config=evidence/'vitest.pg.config.mjs';config.write_text((evidence/'vitest.config.mjs').read_text().replace('"lib/governance/intelligence/__tests__/documentHead.test.ts",\n      "lib/governance/intelligence/__tests__/readHttp.test.ts",\n      "lib/governance/intelligence/__tests__/documentHttp.test.ts"','"lib/governance/intelligence/__tests__/requestService.pg.test.ts"'))
state={'root':str(root),'socket':str(socket),'cachedClient':str(cache),'started':False,'stopped':False,'commands':[],'simulation':'Real owned local PG; paired authority, requester/reviewer and provider denial are synthetic. No human approval or provider qualification.'}
def save(): (evidence/'pg-receipt.json').write_text(json.dumps(state,indent=2)+'\n')
def run(args,label):
 command=['/usr/bin/sandbox-exec','-f',str(profile)]+[str(x) for x in args]
 result=subprocess.run(command,cwd=repo,env=env,capture_output=True,text=True,timeout=90)
 (evidence/(label+'.log')).write_text(result.stdout+result.stderr);state['commands'].append({'label':label,'argv':command,'exit':result.returncode});save()
 if result.returncode:raise RuntimeError(label+' failed; stop without retry')
 return result.stdout
save()
try:
 run([bins/'initdb','-D',root/'data','-U','recovery_fixture','--locale=C','--encoding=UTF8','--auth-local=trust','--auth-host=reject'],'pg-init')
 run([bins/'pg_ctl','-D',root/'data','-l',root/'server.log','-o',"-k "+str(socket)+" -c listen_addresses='' -c unix_socket_permissions=0700",'-w','start'],'pg-start');state['started']=True;save()
 run([bins/'createdb','-w','neondb'],'pg-createdb')
 run([node,deps/'prisma/build/index.js','db','push','--schema',cache/'schema.prisma','--skip-generate'],'pg-empty-fixture-schema')
 run([node,deps/'vitest/vitest.mjs','run','--config',config,'--configLoader','native','--reporter','verbose','--testNamePattern','uses current immutable document heads for independent baseline review without provider reads'],'pg-focused-journey')
finally:
 if state['started']:
  run([bins/'pg_ctl','-D',root/'data','-m','fast','-w','stop'],'pg-stop');state['stopped']=True
 save()
