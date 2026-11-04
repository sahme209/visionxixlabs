"""Fresh owned old-schema rehearsal ONLY. Default describes; no production input."""
import argparse,hashlib,json,os,signal,subprocess,tempfile
from pathlib import Path
from urllib.parse import quote
REPO=Path(__file__).resolve().parents[1]
BASE='d3e591b9f262435cf05fe690742f6898fcebf742'
DRAFT=REPO/'ops/proposals/coding-request-quotes/add-quote-evidence.DRAFT.sql'
SEED=REPO/'docs/recovery/2026-11-04/quote-schema-rehearsal/seed.sql'
PG=Path('/opt/homebrew/opt/postgresql@17/bin');NODE=Path('/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node')
def main():
 old=subprocess.run(['/usr/bin/git','show',BASE+':prisma/schema.prisma'],cwd=REPO,capture_output=True,check=True).stdout
 digest=hashlib.sha256(Path(__file__).read_bytes()+DRAFT.read_bytes()+SEED.read_bytes()+old).hexdigest()
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--reviewed-hash');a=ap.parse_args()
 if a.reviewed_hash is None:print(json.dumps({'hash':digest,'execute':False,'baseline':BASE}));return
 if a.reviewed_hash!=digest:raise RuntimeError('reviewed_packet_required')
 os.umask(0o077);root=Path(tempfile.mkdtemp(prefix='axiom-quote-schema-',dir='/private/tmp')).resolve();sock=root/'socket';sock.mkdir(mode=0o700);home=root/'home';home.mkdir(mode=0o700)
 engine=(REPO/'node_modules/@prisma/engines/schema-engine-darwin-arm64').resolve()
 if hashlib.sha256(engine.read_bytes()).hexdigest()!='57b090d47b947dc9284379d9480d11ffe14fe63155e3da515b359f3aa7fa408a':raise RuntimeError('pinned_installed_engine_required')
 env={'PATH':str(NODE.parent)+':/usr/bin:/bin','HOME':str(home),'TMPDIR':str(root),'LANG':'C','TZ':'UTC','PGHOST':str(sock),'PGPORT':'55498','PGUSER':'quote_schema_fixture','PGDATABASE':'quote_schema_fixture','PRISMA_SCHEMA_ENGINE_BINARY':str(engine),'PRISMA_GENERATE_SKIP_AUTOINSTALL':'true','CHECKPOINT_DISABLE':'1','PRISMA_HIDE_UPDATE_MESSAGE':'true'}
 def run(name,args,check=True):
  p=subprocess.Popen([str(x) for x in args],cwd=root,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,start_new_session=True)
  try:out,err=p.communicate(timeout=90)
  except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.communicate();raise
  (root/(name+'.log')).write_text(out+'\n'+err)
  if check and p.returncode:raise RuntimeError(name+'_failed')
  return p.returncode,out.strip()
 def sql(name,text):return run(name,[PG/'psql','-X','-w','-A','-t','-v','ON_ERROR_STOP=1','-c',text])[1]
 start=False
 try:
  run('init',[PG/'initdb','-D',root/'data','-U','quote_schema_fixture','--locale=C','--encoding=UTF8','--auth-local=trust','--auth-host=reject'])
  start=True;run('start',[PG/'pg_ctl','-D',root/'data','-l',root/'server.log','-o',f"-k {sock} -p 55498 -c listen_addresses='' -c unix_socket_permissions=0700",'-w','start'])
  run('create',[PG/'createdb','-w','quote_schema_fixture'])
  identity=json.loads(sql('identity',"SELECT json_build_object('db',current_database(),'role',current_user,'listen',current_setting('listen_addresses'),'data',current_setting('data_directory'),'tables',(SELECT count(*) FROM information_schema.tables WHERE table_schema='public'))"))
  if identity!={'db':'quote_schema_fixture','role':'quote_schema_fixture','listen':'','data':str(root/'data'),'tables':0}:raise RuntimeError('fresh_owned_empty_target_required')
  env['DATABASE_URL']='postgresql://quote_schema_fixture@localhost:55498/quote_schema_fixture?host='+quote(str(sock),safe='')
  schema=root/'schema.prisma';schema.write_bytes(old)
  run('owned_old_schema',[NODE,REPO/'node_modules/prisma/build/index.js','db','push','--schema',schema,'--skip-generate'])
  run('seed',[PG/'psql','-X','-w','-v','ON_ERROR_STOP=1','--file',SEED])
  def snapshot(name,after=False):
   call="to_jsonb(c)-'admissionContract'-'quoteEvidence'" if after else 'to_jsonb(c)'
   return sql(name,f'''SELECT jsonb_build_object('calls',(SELECT jsonb_agg({call} ORDER BY id) FROM "PipelineAICallReservation" c),'holds',(SELECT jsonb_agg(to_jsonb(h) ORDER BY id) FROM "AIUsageReservation" h),'usage',(SELECT jsonb_agg(to_jsonb(u) ORDER BY id) FROM "UsageEvent" u))::text''')
  before=snapshot('before')
  if len(json.loads(before)['calls'])!=5:raise RuntimeError('five_seed_rows_required')
  run('draft_once',[PG/'psql','-X','-w','-v','ON_ERROR_STOP=1','--file',DRAFT])
  after=snapshot('after',True)
  if before!=after:raise RuntimeError('financial_rows_changed')
  if sql('new_fields', '''SELECT count(*) FROM "PipelineAICallReservation" WHERE "admissionContract"='coding_fixed_hold_v1' AND "quoteEvidence" IS NULL''')!='5':raise RuntimeError('fixed_defaults_required')
  if digest!=hashlib.sha256(Path(__file__).read_bytes()+DRAFT.read_bytes()+SEED.read_bytes()+old).hexdigest():raise RuntimeError('reviewed_source_changed')
  (root/'receipt.json').write_text(json.dumps({'packet':digest,'baseline':BASE,'rowsPreserved':5,'financialSnapshotSha256':hashlib.sha256(before.encode()).hexdigest(),'defaultsCorrect':True,'productionChanged':False,'scope':'full old Prisma schema; five synthetic ledger rows plus holds/usage, not complete cutover/concurrency/backup acceptance'},indent=2))
 finally:
  if start:
   code,_=run('cleanup_status',[PG/'pg_ctl','-D',root/'data','status'],False)
   if code==0:run('stop',[PG/'pg_ctl','-D',root/'data','-m','fast','-w','stop']);code,_=run('stopped',[PG/'pg_ctl','-D',root/'data','status'],False)
   if code!=3:raise RuntimeError('owned_cleanup_uncertain')
  print('Owned evidence: '+str(root))
if __name__=='__main__':main()
