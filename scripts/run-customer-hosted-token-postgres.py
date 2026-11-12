#!/usr/bin/env python3
"""Owned socket-only PostgreSQL ledger tests; no production resources or model.
Applies only the existing workflow migration to one fresh empty database. Never
reads a DATABASE_URL, retries a test, connects over TCP or removes old fixtures.
"""
import hashlib,json,os,signal,subprocess,tempfile
from pathlib import Path
REPO=Path(__file__).resolve().parents[1]
PG=Path('/opt/homebrew/opt/postgresql@17/bin')
NODE=Path('/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node')
TEST='lib/ai/__tests__/customerHostedTokenStore.pg.test.ts'
FILES=[Path(__file__).relative_to(REPO),Path(TEST),Path('lib/ai/customerHostedTokenStore.ts'),Path('lib/ai/customerHostedTokenBudget.ts'),Path('lib/ai/customerHostedTokenRepository.ts'),Path('prisma/migrations/20261013193000_add_durable_agent_workflow/migration.sql')]
def hashes():return {str(p):hashlib.sha256((REPO/p).read_bytes()).hexdigest() for p in FILES}
def main():
 os.umask(0o077)
 root=Path(tempfile.mkdtemp(prefix='axiom-hosted-token-pg-',dir='/private/tmp')).resolve()
 for name in ['socket','home','cache','empty-env']:(root/name).mkdir(mode=0o700)
 env={'PATH':str(NODE.parent)+':/usr/bin:/bin','HOME':str(root/'home'),'TMPDIR':str(root),'LANG':'C','TZ':'UTC','PGHOST':str(root/'socket'),'PGPORT':'55496','PGUSER':'token_fixture','PGDATABASE':'token_fixture','NODE_ENV':'test','AXIOM_HOSTED_TOKEN_PG_ROOT':str(root)}
 before=hashes();started=False
 def run(name,args,timeout=30):
  p=subprocess.Popen([str(a) for a in args],cwd=REPO,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,start_new_session=True)
  try:out=p.communicate(timeout=timeout)[0]
  except subprocess.TimeoutExpired:
   os.killpg(p.pid,signal.SIGKILL);out=p.communicate()[0];(root/(name+'.log')).write_bytes(out);raise RuntimeError(name+'_timeout_no_retry')
  (root/(name+'.log')).write_bytes(out)
  if p.returncode:raise RuntimeError(name+'_failed_see_owned_log')
  return out.decode()
 try:
  run('init',[PG/'initdb','-D',root/'data','-U','token_fixture','--locale=C','--encoding=UTF8','--auth-local=trust','--auth-host=reject','--no-instructions'])
  started=True
  run('start',[PG/'pg_ctl','-D',root/'data','-l',root/'server.log','-o',f"-k {root/'socket'} -p 55496 -c listen_addresses='' -c unix_socket_permissions=0700",'-w','start'])
  run('database',[PG/'createdb','-w','token_fixture'])
  binding=run('binding',[PG/'psql','-XAtw','-v','ON_ERROR_STOP=1','-c',"SELECT json_build_object('db',current_database(),'role',current_user,'listen',current_setting('listen_addresses'),'data',current_setting('data_directory'),'tables',(SELECT count(*) FROM information_schema.tables WHERE table_schema='public'))"])
  if json.loads(binding)!={'db':'token_fixture','role':'token_fixture','listen':'','data':str(root/'data'),'tables':0}:raise RuntimeError('fresh_owned_target_required')
  run('schema',[PG/'psql','-Xw','-v','ON_ERROR_STOP=1','-f',REPO/'prisma/migrations/20261013193000_add_durable_agent_workflow/migration.sql'])
  config={'root':str(REPO),'envDir':str(root/'empty-env'),'cacheDir':str(root/'cache'),'test':{'environment':'node','include':[TEST],'maxWorkers':1,'fileParallelism':False}}
  (root/'vitest.config.mjs').write_text('export default '+json.dumps(config)+';\n')
  run('tests',[NODE,REPO/'node_modules/vitest/vitest.mjs','run','--config',root/'vitest.config.mjs','--configLoader','native','--reporter=json','--outputFile='+str(root/'result.json')],60)
  result=json.loads((root/'result.json').read_text())
  if result['numPassedTests']!=5 or result['numFailedTests'] or result['numPendingTests']:raise RuntimeError('five_actual_non_skipped_tests_required')
  if hashes()!=before:raise RuntimeError('sources_changed')
  (root/'receipt.json').write_text(json.dumps({'tests':5,'database':'actual isolated PostgreSQL','provider':'none','sourceHashes':before,'productionChanged':False},indent=2))
 finally:
  if started:
   run('stop',[PG/'pg_ctl','-D',root/'data','-m','fast','-w','stop'])
   p=subprocess.run([str(PG/'pg_ctl'),'-D',str(root/'data'),'status'],env=env,capture_output=True,timeout=10)
   (root/'stopped.log').write_bytes(p.stdout+p.stderr)
   if p.returncode!=3:raise RuntimeError('owned_stop_unconfirmed')
  print('Owned fixture: '+str(root))
if __name__=='__main__':main()
