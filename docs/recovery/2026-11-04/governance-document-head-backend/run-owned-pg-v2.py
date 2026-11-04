"""PREPARED ONLY: one current-schema, fresh Unix-only synthetic PG journey."""
import os,subprocess,tempfile,json,hashlib,re,shutil
from pathlib import Path
os.umask(0o077)
repo=Path('/private/tmp/axiom-a2-document-head-backend-20261104')
evidence=Path('/private/tmp/axiom-a2-document-head-evidence')
stage=Path('/private/tmp/axiom-website-1b23c208-eh6g339f/stage')
node=Path('/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node')
deps=Path('/private/tmp/axiom-bootstrap-preparation-build-4087adb5-l0z31yy2/stage/node_modules')
bins=Path('/opt/homebrew/opt/postgresql@17/bin')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
assert sha(stage/'prisma/schema.prisma')=='4e35ea3c8645656dbdae19c1ee6427bf526d9b82527de6ef046048dcdb6e617a'
assert sha(repo/'prisma/schema.prisma')==sha(stage/'prisma/schema.prisma')
assert sha(stage/'node_modules/.prisma/client/schema.prisma')=='811b29137db279b05feaccc908cdfeb1b0c7124c6deeebafe4581cfcfcf0ae4b'
assert sha(stage/'node_modules/.prisma/client/index.js')=='d3be4efe111cfefd232d0df4210bffb3df933ec8d1374686931d05014f36f1bc'
source=(repo/'prisma/schema.prisma').read_text();generated=(stage/'node_modules/.prisma/client/schema.prisma').read_text()
blocks=[];bindings=[]
for kind,name in [('model','DurableAgentWorkflow'),('model','DurableAgentWorkflowEvent'),('model','OrgMembership'),('enum','OrgRole')]:
 pattern=r'^'+kind+' '+name+r' \{.*?^\}'
 a=re.search(pattern,source,re.M|re.S).group();b=re.search(pattern,generated,re.M|re.S).group()
 # Existing bounded diff shows only column alignment in DurableAgentWorkflow;
 # all literal tokens/comments/attributes must match after whitespace splitting.
 assert a.split()==b.split(),name+' generated model differs'
 blocks.append(a);bindings.append({'name':name,'currentSha256':hashlib.sha256(a.encode()).hexdigest(),'generatedSha256':hashlib.sha256(b.encode()).hexdigest(),'tokensEqual':True})
root=Path(tempfile.mkdtemp(prefix='axiom-ticket-governance-pg-',dir='/private/tmp')).resolve();socket=root/'socket';socket.mkdir(mode=0o700)
client=Path(tempfile.mkdtemp(prefix='axiom-provider-approval-pg-evidence-',dir='/private/tmp')).resolve()
shutil.copytree(stage/'node_modules/.prisma/client',client/'generated',symlinks=False)
(client/'node_modules').symlink_to(stage/'node_modules',target_is_directory=True)
(client/'package.json').write_text('{}\n')
(client/'schema.prisma').write_text('generator client {\n provider = "prisma-client-js"\n output = "./generated"\n}\ndatasource db {\n provider = "postgresql"\n url = env("DATABASE_URL")\n}\n'+'\n'.join(blocks)+'\n')
profile=evidence/'pg-v2-deny.sb'
profile.write_text('(version 1)\n(allow default)\n(deny network* (remote ip "*:*"))\n'+''.join('(deny file-write* (subpath '+json.dumps(str(p))+'))\n' for p in [Path('/Users/samirahmed/Documents/Codex/2026-10-29/axiom-ticket-install-completion'),deps.parent.parent,stage,client]))
env={'PATH':str(node.parent)+':/usr/bin:/bin','HOME':str(evidence),'TMPDIR':str(evidence),'LANG':'C','TZ':'UTC','NODE_ENV':'test','PGHOST':str(socket),'PGUSER':'recovery_fixture','PGDATABASE':'neondb','DATABASE_URL':'postgresql://recovery_fixture@localhost/neondb?host='+str(socket).replace('/','%2F'),'PRISMA_GENERATE_SKIP_AUTOINSTALL':'true','CHECKPOINT_DISABLE':'1','PRISMA_HIDE_UPDATE_MESSAGE':'1','AXIOM_TICKET_GOVERNANCE_PG_SOCKET':str(socket),'AXIOM_TICKET_GOVERNANCE_PG_CLIENT':str(client/'generated/index.js')}
config=evidence/'vitest.pg-v2.config.mjs'
unit=json.loads((evidence/'vitest.config.mjs').read_text().removeprefix('export default ').strip().removesuffix(';'))
unit['test']['include']=['lib/governance/intelligence/__tests__/requestService.pg.test.ts'];config.write_text('export default '+json.dumps(unit,indent=2)+';\n')
state={'root':str(root),'socket':str(socket),'client':str(client),'bindings':bindings,'fixtureSchemaSha256':sha(client/'schema.prisma'),'generatedCopy':{str(p.relative_to(client)):sha(p) for p in sorted((client/'generated').rglob('*')) if p.is_file()},'environment':env,'startRequested':False,'started':False,'stopped':False,'commands':[],'simulation':'Real owned PG storage; paired auth/requester/reviewer/provider denial are synthetic. No actual human approval/provider qualification.'}
def save():(evidence/'pg-v2-receipt.json').write_text(json.dumps(state,indent=2)+'\n')
def run(args,label,allow_failure=False):
 command=['/usr/bin/sandbox-exec','-f',str(profile)]+[str(x) for x in args]
 try:
  result=subprocess.run(command,cwd=repo,env=env,capture_output=True,text=True,timeout=90)
  (evidence/(label+'.log')).write_text(result.stdout+result.stderr);state['commands'].append({'label':label,'argv':command,'exit':result.returncode});save()
  if result.returncode and not allow_failure:raise RuntimeError(label+' failed; stop without retry')
  return result
 except subprocess.TimeoutExpired as error:
  def text(v):return v.decode(errors='replace') if isinstance(v,bytes) else (v or '')
  (evidence/(label+'.log')).write_text(text(error.stdout)+text(error.stderr));state['commands'].append({'label':label,'argv':command,'timeoutSeconds':90,'exit':None});save();raise
def verify_database(database,label):
 result=run([bins/'psql','-X','-w','-h',socket,'-U','recovery_fixture','-d',database,'-Atc',"SELECT json_build_object('user',current_user,'database',current_database(),'listen',current_setting('listen_addresses'),'data',current_setting('data_directory'))::text"],label)
 value=json.loads(result.stdout.strip());assert value=={'user':'recovery_fixture','database':database,'listen':'','data':str(root/'data')},'not exact fresh owned Unix-only DB'
 state.setdefault('databaseChecks',[]).append(value);save()
save();failure=None
try:
 run([bins/'initdb','-D',root/'data','-U','recovery_fixture','--locale=C','--encoding=UTF8','--auth-local=trust','--auth-host=reject'],'pg-v2-init')
 state['startRequested']=True;save()
 run([bins/'pg_ctl','-D',root/'data','-l',root/'server.log','-o',"-k "+str(socket)+" -c listen_addresses='' -c unix_socket_permissions=0700",'-w','start'],'pg-v2-start');state['started']=True;save()
 verify_database('postgres','pg-v2-pre-createdb-identity')
 run([bins/'createdb','-w','neondb'],'pg-v2-createdb')
 verify_database('neondb','pg-v2-pre-schema-identity')
 run([node,deps/'prisma/build/index.js','db','push','--schema',client/'schema.prisma','--skip-generate'],'pg-v2-empty-fixture-schema')
 run([node,deps/'vitest/vitest.mjs','run','--config',config,'--configLoader','native','--reporter','verbose','--testNamePattern','uses current immutable document heads for independent baseline review without provider reads'],'pg-v2-focused-journey')
except BaseException as error:
 failure=error;state['originalError']={'type':type(error).__name__,'message':str(error)};save()
finally:
 try:
  if state['startRequested']:
   data=root/'data';assert data.is_dir() and not data.is_symlink() and data.resolve()==data and data.stat().st_uid==os.getuid()
   status=run([bins/'pg_ctl','-D',data,'status'],'pg-v2-final-status',True)
   if status.returncode==0:
    pidfile=data/'postmaster.pid';assert pidfile.is_file() and not pidfile.is_symlink()
    pid=int(pidfile.read_text().splitlines()[0]);assert pid>1
    command=run(['/bin/ps','-p',str(pid),'-o','command='],'pg-v2-owned-process').stdout.strip()
    assert 'postgres' in command and str(data) in command,'unconfirmed PID; do not stop'
    state['confirmedOwnedPid']=pid;save()
    run([bins/'pg_ctl','-D',data,'-m','fast','-w','stop'],'pg-v2-stop');state['stopped']=True
   elif status.returncode==3:state['stopped']=True
   else:raise RuntimeError('unknown owned PG status; no broad cleanup')
 except BaseException as cleanup:
  state['cleanupError']={'type':type(cleanup).__name__,'message':str(cleanup)}
  if failure is None:failure=cleanup
 save()
if failure is not None:raise failure
