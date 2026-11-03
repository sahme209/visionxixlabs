"""PREPARED only by child. Root owns invocation; isolated socket-only PostgreSQL."""
import os,re,subprocess,tempfile,json
from pathlib import Path
os.umask(0o077)
repo=Path('/private/tmp/axiom-servicenow-outbound-5580afdb').resolve()
root=Path(tempfile.mkdtemp(prefix='axiom-ticket-governance-pg-',dir='/private/tmp')).resolve()
client=Path(tempfile.mkdtemp(prefix='axiom-provider-approval-pg-evidence-',dir='/private/tmp')).resolve()
socket=root/'socket';socket.mkdir(mode=0o700)
(client/'node_modules').symlink_to(repo/'node_modules',target_is_directory=True)
(client/'package.json').write_text('{}')
bins=Path('/opt/homebrew/opt/postgresql@17/bin')
node='/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node'
env={k:os.environ[k] for k in ['PATH','HOME'] if k in os.environ}
env.update(PATH=str(Path(node).parent)+':/usr/bin:/bin:/usr/sbin:/sbin',LANG='C',TZ='UTC',PGHOST=str(socket),PGUSER='recovery_fixture',PGDATABASE='neondb',PRISMA_GENERATE_SKIP_AUTOINSTALL='true',CHECKPOINT_DISABLE='1',PRISMA_HIDE_UPDATE_MESSAGE='1')
log=Path('/private/tmp/axiom-servicenow-associated-outbound-pg-result.log')
receipt=Path('/private/tmp/axiom-servicenow-associated-outbound-fixture.json')
state={'root':str(root),'client':str(client),'socket':str(socket),'started':False,'stopped':False,'testFile':'lib/desktop/__tests__/serviceNowAssociatedOutbound.pg.test.ts','testStatus':'not_run'}
def save():receipt.write_text(json.dumps(state,indent=2)+'\n')
def run(args):
 r=subprocess.run([str(x) for x in args],cwd=repo,env=env,capture_output=True,text=True,timeout=90)
 if 'node_modules/vitest/vitest.mjs' in [str(x) for x in args]:log.write_text(r.stdout+r.stderr);state['testExitCode']=r.returncode;state['testStatus']='pass' if r.returncode==0 else 'fail';save()
 if r.returncode:print(r.stdout+r.stderr);raise RuntimeError(str(args[0])+' failed')
 return r.stdout
save()
try:
 run([bins/'initdb','-D',root/'data','-U','recovery_fixture','--locale=C','--encoding=UTF8','--auth-local=trust','--auth-host=reject'])
 run([bins/'pg_ctl','-D',root/'data','-l',root/'server.log','-o',"-k "+str(socket)+" -c listen_addresses='' -c unix_socket_permissions=0700",'-w','start']);state['started']=True;save()
 run([bins/'createdb','-w','neondb'])
 source=(repo/'prisma/schema.prisma').read_text();models=[]
 for name in ['DurableAgentWorkflow','DurableAgentWorkflowEvent','TenantIntegrationConnection','OrgMembership']:
  match=re.search(r'^model '+name+r' \{.*?^\}',source,re.S|re.M)
  if not match:raise RuntimeError('exact_model_missing_'+name)
  models.append(match.group())
 enum=re.search(r'^enum OrgRole \{.*?^\}',source,re.S|re.M)
 if not enum:raise RuntimeError('exact_OrgRole_missing')
 models.append(enum.group())
 header='generator client {\n provider = "prisma-client-js"\n output = "./generated"\n}\ndatasource db {\n provider = "postgresql"\n url = env("DATABASE_URL")\n}\n'
 schema=client/'schema.prisma';schema.write_text(header+'\n'.join(models))
 env['DATABASE_URL']='postgresql://recovery_fixture@localhost/neondb?host='+str(socket).replace('/','%2F')
 run([node,'node_modules/prisma/build/index.js','generate','--schema',schema])
 run([node,'node_modules/prisma/build/index.js','db','push','--schema',schema,'--skip-generate'])
 env['AXIOM_TICKET_GOVERNANCE_PG_SOCKET']=str(socket);env['AXIOM_TICKET_GOVERNANCE_PG_CLIENT']=str(client/'generated/index.js')
 print(run([node,'node_modules/vitest/vitest.mjs','run',state['testFile'],'--no-file-parallelism','-t',r'reservation acknowledgement loss|enrollment appearing after claim|close.*(actual canonical unavailable|actual mounted exact write)']))
finally:
 try:
  if state['started']:print(run([bins/'pg_ctl','-D',root/'data','-m','fast','-w','stop']));state['stopped']=True
 finally:save();print('Owned fixture:',root)
