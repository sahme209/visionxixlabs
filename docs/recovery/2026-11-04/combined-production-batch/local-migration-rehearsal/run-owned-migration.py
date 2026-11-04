"""PREPARED ONLY. One fresh local old-schema -> exact additive SQL rehearsal. No production access."""
import os,json,subprocess,tempfile,hashlib
from pathlib import Path
os.umask(0o077)
packet=Path('/private/tmp/axiom-batch-release-readiness-20261104');evidence=packet/'local-migration-rehearsal'
node=Path('/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node');deps=Path('/private/tmp/axiom-bootstrap-preparation-build-4087adb5-l0z31yy2/stage/node_modules');bins=Path('/opt/homebrew/opt/postgresql@17/bin');engine=Path('/private/tmp/axiom-a7-run-budget-evidence/engines/schema-engine')
old=packet/'production-source.prisma';migration=packet/'additive-migration.REVIEW-ONLY.sql'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
assert sha(old)=='4e35ea3c8645656dbdae19c1ee6427bf526d9b82527de6ef046048dcdb6e617a'
assert sha(migration)=='5b00a10d61a3bca3ea50f3dbcc41954d8120d7b4a371a682485bbb2b6fa9ad34'
assert sha(engine)=='57b090d47b947dc9284379d9480d11ffe14fe63155e3da515b359f3aa7fa408a'
assert json.loads((deps/'prisma/package.json').read_text())['version']=='5.22.0'
root=Path(tempfile.mkdtemp(prefix='axiom-schema-migration-pg-',dir='/private/tmp')).resolve();socket=root/'socket';socket.mkdir(mode=0o700);data=root/'data'
profile=evidence/'deny.sb';profile.write_text('(version 1)\n(allow default)\n(deny network* (remote ip "*:*"))\n'+''.join('(deny file-write* (subpath '+json.dumps(str(p))+'))\n' for p in [Path('/Users/samirahmed/Documents/Codex/2026-10-29/axiom-ticket-install-completion'),deps.parent.parent,Path('/private/tmp/axiom-website-1b23c208-eh6g339f'),engine.parent.parent])+''.join('(deny file-write* (literal '+json.dumps(str(p))+'))\n' for p in [old,migration,Path(__file__).resolve()]))
env={'PATH':str(node.parent)+':/usr/bin:/bin','HOME':str(evidence),'TMPDIR':str(evidence),'LANG':'C','TZ':'UTC','PGHOST':str(socket),'PGUSER':'migration_fixture','PGDATABASE':'axiom_schema_fixture','PGPORT':'55440','PRISMA_SCHEMA_ENGINE_BINARY':str(engine),'PRISMA_QUERY_ENGINE_LIBRARY':str(engine.parent/'libquery_engine-darwin-arm64.dylib.node'),'PRISMA_GENERATE_SKIP_AUTOINSTALL':'true','CHECKPOINT_DISABLE':'1','PRISMA_HIDE_UPDATE_MESSAGE':'1','DATABASE_URL':'postgresql://synthetic:synthetic@127.0.0.1:1/synthetic'}
state={'scope':'OWNED LOCAL SYNTHETIC ONLY. No production DB/schema observation or migration approval inferred.','root':str(root),'socket':str(socket),'environment':env,'oldSchemaSha256':sha(old),'exactMigrationSha256':sha(migration),'startRequested':False,'started':False,'stopped':False,'commands':[]}
def save():(evidence/'receipt.json').write_text(json.dumps(state,indent=2)+'\n')
def run(args,label,allow_failure=False):
 argv=['/usr/bin/sandbox-exec','-f',str(profile)]+[str(a) for a in args]
 try:
  result=subprocess.run(argv,env=env,cwd=evidence,capture_output=True,text=True,timeout=90)
  (evidence/(label+'.stdout.log')).write_text(result.stdout);(evidence/(label+'.stderr.log')).write_text(result.stderr);state['commands'].append({'label':label,'argv':argv,'exit':result.returncode});save()
  if result.returncode and not allow_failure:raise RuntimeError(label+' failed; no automatic retry')
  return result
 except subprocess.TimeoutExpired as error:
  def text(v):return v.decode(errors='replace') if isinstance(v,bytes) else (v or '')
  (evidence/(label+'.stdout.log')).write_text(text(error.stdout));(evidence/(label+'.stderr.log')).write_text(text(error.stderr));state['commands'].append({'label':label,'argv':argv,'exit':None,'timeoutSeconds':90});save();raise
psql=[bins/'psql','-X','-w','-h',socket,'-p','55440','-U','migration_fixture','-v','ON_ERROR_STOP=1']
def query(sql,label,db='axiom_schema_fixture'):
 return run(psql+['-d',db,'-Atc',sql],label).stdout.strip()
def verify(db,label):
 value=json.loads(query("SELECT json_build_object('database',current_database(),'user',current_user,'listen',current_setting('listen_addresses'),'data',current_setting('data_directory'))",label,db));assert value=={'database':db,'user':'migration_fixture','listen':'','data':str(data)},'wrong DB identity';state.setdefault('identityChecks',[]).append(value);save()
def snapshot(new=False):
 stage="to_jsonb(t)-'aiClaimGeneration'" if new else 'to_jsonb(t)'
 return "SELECT jsonb_build_object('runs',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM \"PipelineRun\" t),'stages',(SELECT jsonb_agg("+stage+" ORDER BY id) FROM \"PipelineStageRun\" t),'holds',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM \"AIUsageReservation\" t))"
save();failure=None
try:
 # Offline schema-to-DDL: no DB URL supplied to diff, networking denied.
 baseline=run([node,deps/'prisma/build/index.js','migrate','diff','--from-empty','--to-schema-datamodel',old,'--script'],'offline-old-schema-ddl').stdout
 (evidence/'old-schema.fixture.sql').write_text(baseline);state['oldFixtureDDLSha256']=hashlib.sha256(baseline.encode()).hexdigest();save()
 run([bins/'initdb','-D',data,'-U','migration_fixture','--locale=C','--encoding=UTF8','--auth-local=trust','--auth-host=reject'],'initdb')
 state['startRequested']=True;save();run([bins/'pg_ctl','-D',data,'-l',root/'server.log','-o',f"-k {socket} -p 55440 -c listen_addresses='' -c unix_socket_permissions=0700",'-w','start'],'start');state['started']=True;save()
 verify('postgres','pre-createdb-identity');run([bins/'createdb','-w','-h',socket,'-p','55440','-U','migration_fixture','axiom_schema_fixture'],'createdb');verify('axiom_schema_fixture','pre-old-schema-identity')
 # Full exact historical Prisma schema, exclusively in this fresh empty fixture.
 run(psql+['-d','axiom_schema_fixture','--single-transaction','-c',"SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='60s';",'-f',evidence/'old-schema.fixture.sql'],'create-old-fixture-schema')
 seed=evidence/'seed.sql';seed.write_text('''INSERT INTO "PipelineRun"(id,"organizationId","pipelineId",status,"triggeredBy","correlationId",metadata,"updatedAt") VALUES ('synthetic-run-a','synthetic-org-a','ai_coding','running','synthetic-actor','synthetic-correlation','{"synthetic":true}',TIMESTAMP '2026-01-01'),('synthetic-run-b','synthetic-org-b','ai_coding','queued','synthetic-actor-b','synthetic-correlation-b','{"synthetic":true}',TIMESTAMP '2026-01-01');
INSERT INTO "PipelineStageRun"(id,"runId","stageId","stageKind",ordering,status,"costCents","outputDetail","updatedAt") VALUES ('synthetic-stage-a','synthetic-run-a','propose','code_propose',1,'queued',17,'{"synthetic":"preserve"}',TIMESTAMP '2026-01-01'),('synthetic-stage-extra','synthetic-run-a','extra','code_propose',2,'queued',0,'{}',TIMESTAMP '2026-01-01'),('synthetic-stage-b','synthetic-run-b','propose','code_propose',1,'queued',0,'{}',TIMESTAMP '2026-01-01');
INSERT INTO "AIUsageReservation"(id,"organizationId","idempotencyKey","reservedCents",status,"correlationId","expiresAt","updatedAt") VALUES ('synthetic-hold-a','synthetic-org-a','synthetic-original-hold-a',123,'reserved','synthetic-correlation',TIMESTAMP '2026-01-01',TIMESTAMP '2026-01-01'),('synthetic-hold-extra','synthetic-org-a','synthetic-original-hold-extra',124,'reserved','synthetic-correlation',TIMESTAMP '2026-01-01',TIMESTAMP '2026-01-01'),('synthetic-hold-b','synthetic-org-b','synthetic-original-hold-b',125,'reserved','synthetic-correlation-b',TIMESTAMP '2026-01-01',TIMESTAMP '2026-01-01');
''')
 run(psql+['-d','axiom_schema_fixture','--single-transaction','-f',seed],'seed-old-schema');before=json.loads(query(snapshot(),'before-rows'));verify('axiom_schema_fixture','pre-exact-migration-identity')
 assert sha(migration)==state['exactMigrationSha256']
 # EXACT review SQL passed as-is ONCE; psql wraps it and timeout settings in ONE transaction.
 run(psql+['-d','axiom_schema_fixture','--single-transaction','-c',"SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';",'-f',migration],'apply-exact-additive-sql-once')
 after=json.loads(query(snapshot(True),'after-rows'));assert before==after,'historical row mutation';assert query('SELECT count(*) FROM "PipelineAICallReservation"','empty-new-ledger')=='0'
 assert query('SELECT count(*) FROM "PipelineStageRun" WHERE "aiClaimGeneration" IS NOT NULL','existing-nullable-claims')=='0'
 assert json.loads(query("SELECT json_build_object('type',data_type,'nullable',is_nullable,'default',column_default) FROM information_schema.columns WHERE table_schema='public' AND table_name='PipelineStageRun' AND column_name='aiClaimGeneration'",'new-column-contract'))=={'type':'text','nullable':'YES','default':None}
 expected={
 'PipelineAICallReservation_workspaceReservationId_key':('PipelineAICallReservation',True,['workspaceReservationId']), 'PipelineAICallReservation_usageEventId_key':('PipelineAICallReservation',True,['usageEventId']), 'PipelineAICallReservation_externalUsageId_key':('PipelineAICallReservation',True,['externalUsageId']), 'PipelineAICallReservation_runId_status_idx':('PipelineAICallReservation',False,['runId','status']), 'PipelineAICallReservation_organizationId_workspaceReservati_key':('PipelineAICallReservation',True,['organizationId','workspaceReservationId']), 'PipelineAICallReservation_organizationId_stageRunId_phase_key':('PipelineAICallReservation',True,['organizationId','stageRunId','phase']), 'PipelineAICallReservation_organizationId_idempotencyKey_key':('PipelineAICallReservation',True,['organizationId','idempotencyKey']), 'PipelineRun_organizationId_id_key':('PipelineRun',True,['organizationId','id']), 'PipelineStageRun_runId_id_key':('PipelineStageRun',True,['runId','id']), 'AIUsageReservation_organizationId_id_key':('AIUsageReservation',True,['organizationId','id'])}
 indexrows=json.loads(query('''SELECT json_agg(x) FROM (SELECT idx.relname AS name,t.relname AS table_name,i.indisunique AS unique,i.indisvalid AS valid,i.indisready AS ready,(SELECT array_agg(a.attname ORDER BY u.n) FROM unnest(i.indkey) WITH ORDINALITY u(att,n) JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=u.att) AS columns FROM pg_index i JOIN pg_class idx ON idx.oid=i.indexrelid JOIN pg_class t ON t.oid=i.indrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public')x''','indexes'))
 for name,(table,unique,columns) in expected.items():
  got=[x for x in indexrows if x['name']==name];assert got==[{'name':name,'table_name':table,'unique':unique,'valid':True,'ready':True,'columns':columns}],name
 fkrows=json.loads(query('''SELECT json_agg(x) FROM (SELECT c.conname AS name,t.relname AS parent,c.confdeltype AS delete_action,c.confupdtype AS update_action,c.convalidated AS validated,(SELECT array_agg(a.attname ORDER BY u.n) FROM unnest(c.conkey) WITH ORDINALITY u(att,n) JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=u.att) AS columns,(SELECT array_agg(a.attname ORDER BY u.n) FROM unnest(c.confkey) WITH ORDINALITY u(att,n) JOIN pg_attribute a ON a.attrelid=c.confrelid AND a.attnum=u.att) AS parent_columns FROM pg_constraint c JOIN pg_class t ON t.oid=c.confrelid WHERE c.conrelid='"PipelineAICallReservation"'::regclass AND c.contype='f')x''','foreign-keys'))
 expected_fks={'PipelineRun':(['organizationId','runId'],['organizationId','id']),'PipelineStageRun':(['runId','stageRunId'],['runId','id']),'AIUsageReservation':(['organizationId','workspaceReservationId'],['organizationId','id'])}
 assert len(fkrows)==3
 for fk in fkrows:
  assert fk['delete_action']=='r' and fk['update_action']=='c' and fk['validated'] is True
  assert (fk['columns'],fk['parent_columns'])==expected_fks[fk['parent']]
 # Constraint fixtures only: no claim/dispatch/usage/AI authority is exercised.
 base={'id':'synthetic-call-main','organizationId':'synthetic-org-a','runId':'synthetic-run-a','stageRunId':'synthetic-stage-a','phase':'initial','claimGeneration':'synthetic-no-runtime-authority','idempotencyKey':'synthetic-main-call','workspaceReservationId':'synthetic-hold-a','actorId':'synthetic-actor','correlationId':'synthetic-correlation','estimatedCents':123,'capCents':500,'capSource':'platform_default','updatedAt':'2026-01-01'}
 def insert(overrides):
  row={**base,**overrides};return 'INSERT INTO "PipelineAICallReservation"('+','.join('"'+k+'"' for k in row)+') VALUES ('+','.join(str(v) if isinstance(v,int) else "'"+v.replace("'","''")+"'" for v in row.values())+');'
 query(insert({}),'valid-tenant-link')
 failures=[('foreign-run',{'id':'bad-run','runId':'synthetic-run-b','stageRunId':'synthetic-stage-b','workspaceReservationId':'synthetic-hold-extra'},'foreign_key_violation'),('foreign-stage',{'id':'bad-stage','stageRunId':'synthetic-stage-b','workspaceReservationId':'synthetic-hold-extra'},'foreign_key_violation'),('foreign-workspace',{'id':'bad-workspace','workspaceReservationId':'synthetic-hold-b'},'foreign_key_violation'),('workspace-one-use',{'id':'bad-workspace-unique','phase':'refinement','idempotencyKey':'synthetic-other'},'unique_violation'),('phase-one-use',{'id':'bad-phase','workspaceReservationId':'synthetic-hold-extra','idempotencyKey':'synthetic-other'},'unique_violation'),('idempotency-one-use',{'id':'bad-idempotency','stageRunId':'synthetic-stage-extra','workspaceReservationId':'synthetic-hold-extra'},'unique_violation')]
 for label,overrides,error in failures:
  # Avoid an unrelated unique constraint masking the expected FK failure.
  if error=='foreign_key_violation':overrides={**overrides,'idempotencyKey':'synthetic-'+label,'phase':'refinement'}
  sql='DO $$ BEGIN BEGIN '+insert(overrides)+" RAISE EXCEPTION 'constraint_did_not_refuse'; EXCEPTION WHEN "+error+' THEN NULL; END; END $$;'
  query(sql,'constraint-'+label)
 for field in ['usageEventId','externalUsageId']:
  sql='DO $$ BEGIN BEGIN UPDATE "PipelineAICallReservation" SET "'+field+'"=\'synthetic-unique-link\' WHERE id=\'synthetic-call-main\'; '+insert({'id':'bad-'+field,'stageRunId':'synthetic-stage-extra','workspaceReservationId':'synthetic-hold-extra','idempotencyKey':'synthetic-'+field,field:'synthetic-unique-link'})+" RAISE EXCEPTION 'constraint_did_not_refuse'; EXCEPTION WHEN unique_violation THEN NULL; END; END $$;"
  query(sql,'constraint-'+field)
 assert json.loads(query(snapshot(True),'final-preserved-rows'))==before
 assert query('SELECT count(*) FROM "PipelineAICallReservation"','final-ledger-count')=='1'
 assert sha(old)==state['oldSchemaSha256'] and sha(migration)==state['exactMigrationSha256']
 state['result']={'historicalRowsUnchanged':True,'newColumnNullableExistingNull':True,'ledgerInitiallyEmpty':True,'indexesChecked':10,'foreignKeysChecked':3,'tenantAndUniqueRefusalsChecked':8,'migrationAppliedOnce':True,'noDownMigrationOrDeletion':True,'runtimeAdmissionNotTested':True};save()
except BaseException as error:failure=error;state['originalError']={'type':type(error).__name__,'message':str(error)};save()
finally:
 try:
  if state['startRequested']:
   assert data.is_dir() and not data.is_symlink() and data.resolve()==data and data.stat().st_uid==os.getuid()
   status=run([bins/'pg_ctl','-D',data,'status'],'final-owned-status',True)
   if status.returncode==0:
    pidfile=data/'postmaster.pid';assert pidfile.is_file() and not pidfile.is_symlink();lines=pidfile.read_text().splitlines();pid=int(lines[0]);assert pid>1 and lines[1]==str(data)
    assert 'PID: '+str(pid) in status.stdout and 'postgres' in status.stdout and str(data) in status.stdout and str(socket) in status.stdout
    state['confirmedOwnedPid']=pid;save();run([bins/'pg_ctl','-D',data,'-m','fast','-w','stop'],'stop-owned');state['stopped']=True
   elif status.returncode==3:state['stopped']=True
   else:raise RuntimeError('unknown owned process status; no broad cleanup')
 except BaseException as cleanup:
  state['cleanupError']={'type':type(cleanup).__name__,'message':str(cleanup)}
  if failure is None:failure=cleanup
 save()
if failure is not None:raise failure
