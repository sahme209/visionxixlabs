#!/usr/bin/env python3
"""Owned socket-only PostgreSQL platform Governance tests; no production resources or model.
Applies only the proposed platform fixture schema to one fresh empty database. Never
reads a DATABASE_URL, retries a test, connects over TCP or removes old fixtures.
"""
import hashlib,json,os,signal,subprocess,tempfile
from pathlib import Path
from urllib.parse import quote
REPO=Path(__file__).resolve().parents[1]
PG=Path('/opt/homebrew/opt/postgresql@17/bin')
NODE=Path('/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node')
TEST='lib/governance/platform/__tests__/sqlRepository.pg.test.ts'
FILES=[Path(__file__).relative_to(REPO),Path('prisma/schema.prisma')]+sorted(Path('lib/governance/platform').rglob('*.ts'))+[Path('lib/governance/platform/fixtureSchema.sql')]
def hashes():return {str(p):hashlib.sha256((REPO/p).read_bytes()).hexdigest() for p in FILES}
def main():
 os.umask(0o077)
 root=Path(tempfile.mkdtemp(prefix='axiom-platform-pg-',dir='/private/tmp')).resolve()
 for name in ['socket','home','cache','empty-env']:(root/name).mkdir(mode=0o700)
 env={'PATH':str(NODE.parent)+':/usr/bin:/bin','HOME':str(root/'home'),'TMPDIR':str(root),'LANG':'C','TZ':'UTC','PGHOST':str(root/'socket'),'PGPORT':'55497','PGUSER':'platform_fixture','PGDATABASE':'platform_fixture','NODE_ENV':'test','AXIOM_PLATFORM_PG_ROOT':str(root)}
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
  run('init',[PG/'initdb','-D',root/'data','-U','platform_fixture','--locale=C','--encoding=UTF8','--auth-local=trust','--auth-host=reject','--no-instructions'])
  started=True
  run('start',[PG/'pg_ctl','-D',root/'data','-l',root/'server.log','-o',f"-k {root/'socket'} -p 55497 -c listen_addresses='' -c unix_socket_permissions=0700",'-w','start'])
  run('database',[PG/'createdb','-w','platform_fixture'])
  binding=run('binding',[PG/'psql','-XAtw','-v','ON_ERROR_STOP=1','-c',"SELECT json_build_object('db',current_database(),'role',current_user,'listen',current_setting('listen_addresses'),'data',current_setting('data_directory'),'tables',(SELECT count(*) FROM information_schema.tables WHERE table_schema='public'))"])
  if json.loads(binding)!={'db':'platform_fixture','role':'platform_fixture','listen':'','data':str(root/'data'),'tables':0}:raise RuntimeError('fresh_owned_target_required')
  run('schema',[PG/'psql','-Xw','-v','ON_ERROR_STOP=1','-f',REPO/'lib/governance/platform/fixtureSchema.sql'])
  env['DATABASE_URL']='postgresql://platform_fixture@localhost:55497/platform_fixture?host='+quote(str(root/'socket'),safe='')
  config={'root':str(REPO),'envDir':str(root/'empty-env'),'cacheDir':str(root/'cache'),'resolve':{'alias':{'@':str(REPO),'server-only':str(REPO/'test/serverOnlyStub.ts')}},'test':{'environment':'node','include':[TEST],'maxWorkers':1,'fileParallelism':False}}
  (root/'vitest.config.mjs').write_text('export default '+json.dumps(config)+';\n')
  run('tests',[NODE,REPO/'node_modules/vitest/vitest.mjs','run','--config',root/'vitest.config.mjs','--configLoader','native','--reporter=json','--outputFile='+str(root/'result.json')],60)
  result=json.loads((root/'result.json').read_text())
  if result['numPassedTests']!=3 or result['numFailedTests'] or result['numPendingTests']:raise RuntimeError('three_actual_non_skipped_tests_required')
  if hashes()!=before:raise RuntimeError('sources_changed')
  (root/'receipt.json').write_text(json.dumps({'tests':3,'database':'actual isolated PostgreSQL','authorityAndProvider':'simulated; no actual provider dispatched','sourceHashes':before,'productionChanged':False},indent=2))
 finally:
  if started:
   run('stop',[PG/'pg_ctl','-D',root/'data','-m','fast','-w','stop'])
   p=subprocess.run([str(PG/'pg_ctl'),'-D',str(root/'data'),'status'],env=env,capture_output=True,timeout=10)
   (root/'stopped.log').write_bytes(p.stdout+p.stderr)
   if p.returncode!=3:raise RuntimeError('owned_stop_unconfirmed')
  print('Owned fixture: '+str(root))
if __name__=='__main__':main()
