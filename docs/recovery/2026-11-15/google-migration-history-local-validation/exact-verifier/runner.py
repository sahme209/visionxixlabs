"""Fresh owned PG17 SQL acceptance. Prepare is file-only; execute after review."""
from pathlib import Path
import hashlib,importlib.util,json,os,signal,socket,subprocess,sys,tempfile,time,secrets,shutil
sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent
ROOT=Path('/private/tmp/v19-customer-demo-website-xdm6qgzs/source')
HELPER=Path('/Users/samirahmed/.codex/worktrees/axiom-governance-recovery-2026-11-14/docs/recovery/2026-11-15/exact-release-render-preparation/executor.py')
HELPER_SHA='8e69b92145a98e13f0d3ff2872de8407f814df0101a0bf9b4820a571818832e9'
PG=Path('/opt/homebrew/opt/postgresql@17/bin')
NODE=Path('/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node')
OPENSSL=Path('/usr/bin/openssl')
CAP=1024*1024
TOTAL=240
MODULES=['pg','pg-pool','pg-protocol','pg-types','pg-connection-string','pgpass','pg-int8','postgres-array','postgres-bytea','postgres-date','postgres-interval','split2','xtend','pg-cloudflare']
def need(ok,code):
 if not ok:raise RuntimeError(code)
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def helper():
 need(digest(HELPER)==HELPER_SHA,'owned_helper_changed')
 spec=importlib.util.spec_from_file_location('owned_pg17_helpers',HELPER);unit=importlib.util.module_from_spec(spec);spec.loader.exec_module(unit);return unit

def prepare():
 need(not(HERE/'INPUTS.json').exists() and not(HERE/'ATTEMPT.json').exists(),'owned_packet_exists')
 unit=helper();files={}
 for p in HERE.iterdir():
  if p.is_file():files[str(p)]=digest(p)
 for p in [HELPER,NODE,PG/'postgres',PG/'initdb',OPENSSL,Path('/usr/bin/sandbox-exec'),Path('/usr/bin/true'),ROOT/'package.json']:files[str(p)]=digest(p)
 source=json.loads((HERE/'SOURCE-MIGRATIONS.json').read_text());sourceRoot=Path('/Users/samirahmed/.codex/worktrees/axiom-governance-recovery-2026-11-14')
 for row in source['migrations']:
  p=sourceRoot/'prisma/migrations'/row['name']/'migration.sql';need(digest(p)==row['checksum'],'current_migration_source_changed');files[str(p)]=digest(p)
 cache=unit.inventory([ROOT/'node_modules'/name for name in MODULES])
 packet={'preparedOnly':True,'productionAccess':False,'localExecutionOnly':True,'sourceFiles':len(source['migrations']),'files':files,'cacheInventory':cache,'limits':{'seconds':TOTAL,'logBytes':CAP,'clientSeconds':120},'expectedPostgres':'17.11','expectedRole':'fictional local neondb_owner','providerCoordinatesNeverUsedForConnection':True}
 with (HERE/'INPUTS.json').open('x') as out:json.dump(packet,out,indent=2);out.write('\n')
 print(json.dumps({'prepared':True,'packetSha256':digest(HERE/'INPUTS.json'),'files':len(files),'cacheEntries':len(cache)}))

def stop(child):
 if child is None:return
 if child.poll() is None:
  try:os.killpg(child.pid,signal.SIGINT)
  except ProcessLookupError:pass
  try:child.wait(timeout=5)
  except subprocess.TimeoutExpired:
   if child.poll() is None:
    try:os.killpg(child.pid,signal.SIGKILL)
    except ProcessLookupError:pass
   child.wait(timeout=2)
 # Never signal an already-reaped PID/group; an unexpected surviving group
 # must be reported unconfirmed instead of guessing its current ownership.
 try:os.killpg(child.pid,0)
 except ProcessLookupError:return
 raise RuntimeError('owned_process_group_not_empty')
def main():
 manifest=json.loads((HERE/'INPUTS.json').read_text())
 need(manifest['preparedOnly'] is True and manifest.get('localExecutionOnly') is True,'local_owned_packet_required')
 need(ROOT.resolve()==ROOT,'canonical_module_root')
 unit=helper();unit.verify_inventory(manifest['cacheInventory'])
 for name,h in manifest['files'].items():need(digest(Path(name))==h,'reviewed_input_changed')
 need(not (HERE/'ATTEMPT.json').exists(),'attempt_consumed')
 (HERE/'ATTEMPT.json').write_text('{"consumed":true}\n')
 os.umask(0o077)
 def cancelled(_signal,_frame):raise RuntimeError('owned_batch_cancelled')
 old_handlers={sig:signal.signal(sig,cancelled) for sig in [signal.SIGINT,signal.SIGTERM,signal.SIGHUP]}
 owned=Path(tempfile.mkdtemp(prefix='v19-google-exact-verifier-owned-pg17-',dir='/private/tmp'))
 env={'PATH':f'{NODE.parent}:/usr/bin:/bin','HOME':str(owned),'TMPDIR':str(owned),'LC_ALL':'C','LANG':'C'}
 deadline=time.monotonic()+TOTAL;server=None;active=None;records=[];accepted=False;failure=None
 log=owned/'postgres.log'
 def limits():
  need(time.monotonic()<deadline,'owned_batch_deadline')
  for p in owned.glob('*.log'):need(p.stat().st_size<=CAP,'owned_output_limit')
 def run(label,args,seconds=30,extra=None):
  nonlocal active
  limits();path=owned/(label+'.log');started=time.monotonic()
  with path.open('xb') as out:
   active=subprocess.Popen([str(v) for v in args],stdin=subprocess.DEVNULL,stdout=out,stderr=subprocess.STDOUT,env={**env,**(extra or {})},cwd=owned,start_new_session=True)
   try:
    end=min(deadline,time.monotonic()+seconds)
    while active.poll() is None:
     limits();need(time.monotonic()<end,'owned_phase_deadline');time.sleep(.05)
    need(active.returncode==0,'owned_phase_failed');limits()
    records.append({'phase':label,'exit':0,'seconds':round(time.monotonic()-started,3),'logSha256':digest(path)})
   finally:stop(active);active=None
 try:
  # Validate this exact runtime profile before initdb, keys or any server.
  with socket.socket() as pg_reservation:
   pg_reservation.bind(('127.0.0.1',0));port=pg_reservation.getsockname()[1]
  profile=f'(version 1)(allow default)(deny network*)(deny file-write*)(allow file-write* (subpath "{owned}"))(allow file-write-data (literal "/dev/null"))(allow network-outbound (remote tcp "localhost:{port}"))'
  run('sandbox-profile-preflight',['/usr/bin/sandbox-exec','-p',profile,'/usr/bin/true'],5)
  password=secrets.token_hex(24);(owned/'password').write_text(password+'\n')
  run('postgres-version',[PG/'postgres','--version'],5)
  need((owned/'postgres-version.log').read_text().startswith('postgres (PostgreSQL) 17.11'),'postgres_version_changed')
  run('initdb',[PG/'initdb','-D',owned/'data','--username=neondb_owner','--pwfile',owned/'password','--auth-local=reject','--auth-host=scram-sha-256','--encoding=UTF8','--locale=C'],45)
  (owned/'ca.cnf').write_text('[req]\ndistinguished_name=dn\nx509_extensions=ca\nprompt=no\n[dn]\nCN=Owned local integration CA\n[ca]\nbasicConstraints=critical,CA:TRUE\nkeyUsage=critical,keyCertSign,cRLSign\n')
  run('ca',[OPENSSL,'req','-x509','-newkey','rsa:2048','-nodes','-sha256','-days','1','-keyout',owned/'ca.key','-out',owned/'ca.crt','-config',owned/'ca.cnf'],15)
  (owned/'leaf.cnf').write_text('[req]\ndistinguished_name=dn\nprompt=no\n[dn]\nCN=Owned loopback PostgreSQL\n')
  (owned/'leaf.ext').write_text('basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=IP:127.0.0.1\n')
  run('csr',[OPENSSL,'req','-new','-newkey','rsa:2048','-nodes','-sha256','-keyout',owned/'server.key','-out',owned/'server.csr','-config',owned/'leaf.cnf'],15)
  run('sign',[OPENSSL,'x509','-req','-in',owned/'server.csr','-CA',owned/'ca.crt','-CAkey',owned/'ca.key','-CAcreateserial','-out',owned/'server.crt','-days','1','-sha256','-extfile',owned/'leaf.ext'],15)
  data=owned/'data'
  (data/'pg_hba.conf').write_text('hostssl all neondb_owner 127.0.0.1/32 scram-sha-256\nhost all all 127.0.0.1/32 reject\nlocal all all reject\n')
  with (data/'postgresql.conf').open('a') as conf:conf.write(f"\nlisten_addresses='127.0.0.1'\nport={port}\nunix_socket_directories=''\nssl=on\nssl_cert_file='{owned}/server.crt'\nssl_key_file='{owned}/server.key'\npassword_encryption='scram-sha-256'\nlogging_collector=off\nlog_connections=off\nlog_statement='none'\nlog_min_error_statement='panic'\nlog_error_verbosity='terse'\ntimezone='UTC'\nmax_connections=10\nshared_buffers='16MB'\n")
  with log.open('xb') as out:
   server=subprocess.Popen([str(PG/'postgres'),'-D',str(data)],stdin=subprocess.DEVNULL,stdout=out,stderr=subprocess.STDOUT,env=env,cwd=owned,start_new_session=True)
   end=min(deadline,time.monotonic()+15)
   while True:
    limits();need(server.poll() is None,'owned_postgres_start_failed')
    if b'database system is ready to accept connections' in log.read_bytes():break
    need(time.monotonic()<end,'owned_postgres_start_deadline');time.sleep(.05)
   run('owned-migration',['/usr/bin/sandbox-exec','-p',profile,NODE,HERE/'client.cjs',ROOT,owned,port],130,{'NODE_EXTRA_CA_CERTS':str(owned/'ca.crt'),'TZ':'UTC'})
   result=json.loads((owned/'CLIENT-RESULT.json').read_text());need(result.get('accepted') is True,'integration_not_accepted')
   for name,h in manifest['files'].items():need(digest(Path(name))==h,'source_changed_during_integration')
   unit.verify_inventory(manifest['cacheInventory'])
   limits();accepted=True
 except BaseException as error:failure=str(error) if isinstance(error,RuntimeError) else type(error).__name__
 finally:
  for sig in [signal.SIGINT,signal.SIGTERM,signal.SIGHUP]:signal.signal(sig,signal.SIG_IGN)
  groups_empty=True
  for process in [active,server]:
   try:stop(process)
   except BaseException:groups_empty=False;accepted=False;failure='owned_cleanup_unconfirmed'
  for name in ['password','ca.key','server.key']:
   try:(owned/name).unlink(missing_ok=True)
   except OSError:accepted=False;failure='ephemeral_key_cleanup_unconfirmed'
  try:
   data=owned/'data'
   need(not data.is_symlink() and data.parent==owned,'owned_cluster_identity_changed')
   need(groups_empty,'owned_cleanup_unconfirmed')
   if data.exists():shutil.rmtree(data)
  except BaseException:accepted=False;failure='owned_cluster_cleanup_unconfirmed'
  for p in owned.glob('*.log'):
   if p.stat().st_size>CAP:
    with p.open('r+b') as stream:stream.truncate(CAP)
    accepted=False;failure='owned_output_limit'
  receipt={'accepted':accepted,'failure':failure,'ownedDirectory':str(owned),'phases':records,'productionAccess':False,'loopbackOnly':True,'nativeAppOrGovernance':False,'ownedProcessGroupsEmpty':groups_empty,'ownedClusterRemoved':not (owned/'data').exists(),'privateKeysRemoved':all(not (owned/n).exists() for n in ['password','ca.key','server.key'])}
  try:
   (owned/'RESULT.json').write_text(json.dumps(receipt,indent=2)+'\n');(HERE/'RESULT.json').write_text(json.dumps(receipt,indent=2)+'\n')
   print(json.dumps(receipt))
  finally:
   for sig,handler in old_handlers.items():signal.signal(sig,handler)
 return 0 if accepted else 1
if __name__=='__main__':
 if sys.argv[1:]==['prepare']:prepare()
 elif len(sys.argv)==3 and sys.argv[1]=='execute':
  need(digest(HERE/'INPUTS.json')==sys.argv[2],'owned_packet_hash_changed');raise SystemExit(main())
 else:raise SystemExit('fixed_prepare_or_execute_required')
