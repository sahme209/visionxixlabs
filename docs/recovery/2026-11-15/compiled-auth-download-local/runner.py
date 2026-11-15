"""PREPARED ONLY: bounded fresh local PostgreSQL17/Prisma integration.
Run only after root review. No daemon, external host, production configuration,
package installation, migrations, real account, or persistent credential use.
"""
from pathlib import Path
import hashlib,json,os,signal,socket,subprocess,tempfile,time,secrets,shutil
HERE=Path(__file__).resolve().parent
ROOT=Path('/private/tmp/axiom-current-web-desktop-xfna45q5/source')
PG=Path('/opt/homebrew/opt/postgresql@17/bin')
NODE=Path('/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node')
OPENSSL=Path('/usr/bin/openssl')
CAP=1024*1024
TOTAL=240
INPUT_NAMES=['lib/database/createDatabaseClient.ts','lib/database/directNeonSession.ts',
 'lib/database/requiredChannelBinding.ts','lib/database/postgresConnectionPolicy.ts',
 'lib/prismaClient.ts','lib/generated/prisma/client.js','lib/generated/prisma/internal/class.js',
 'node_modules/pg/lib/client.js','node_modules/pg/lib/connection.js','node_modules/pg/lib/crypto/sasl.js',
 'node_modules/pg/lib/crypto/cert-signatures.js','node_modules/pg-pool/index.js',
 'node_modules/@prisma/adapter-pg/dist/index.js']
def need(ok,code):
 if not ok: raise RuntimeError(code)
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
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
 need(manifest['preparedOnly'] is True,'proposal_marker')
 receipt=json.loads((ROOT.parent/'RESULT.json').read_text())
 need(receipt.get('accepted') is True and receipt.get('finalInputsMatched') is True and receipt.get('stage')==str(ROOT.parent),'compiled_build_unaccepted')
 def compiled_tree():
  rows=[]
  for p in sorted((ROOT/'.next').rglob('*')):
   need(not p.is_symlink(),'compiled_output_link')
   if p.is_file() and 'cache' not in p.relative_to(ROOT/'.next').parts: rows.append(str(p.relative_to(ROOT))+':'+digest(p))
  return hashlib.sha256('\n'.join(rows).encode()).hexdigest()
 need(compiled_tree()==manifest['compiledTreeSha256'],'compiled_outputs_changed')
 for name,h in manifest['files'].items():need(digest(Path(name))==h,'reviewed_input_changed')
 need(not (HERE/'ATTEMPT.json').exists(),'attempt_consumed')
 (HERE/'ATTEMPT.json').write_text('{"consumed":true}\n')
 os.umask(0o077)
 def cancelled(_signal,_frame):raise RuntimeError('owned_batch_cancelled')
 old_handlers={sig:signal.signal(sig,cancelled) for sig in [signal.SIGINT,signal.SIGTERM,signal.SIGHUP]}
 owned=Path(tempfile.mkdtemp(prefix='axiom-compiled-next-pg17-',dir='/private/tmp'))
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
  with socket.socket() as pg_reservation,socket.socket() as http_reservation:
   pg_reservation.bind(('127.0.0.1',0));http_reservation.bind(('127.0.0.1',0))
   port=pg_reservation.getsockname()[1];http_port=http_reservation.getsockname()[1]
  need(http_port!=port,'owned_port_collision')
  profile=f'(version 1)(allow default)(deny network*)(deny file-write*)(allow file-write* (subpath "{owned}"))(allow file-write-data (literal "/dev/null"))(allow network-bind (local tcp "localhost:{http_port}"))(allow network-inbound (local tcp "localhost:{http_port}"))(allow network-outbound (remote tcp "localhost:{http_port}"))(allow network-outbound (remote tcp "localhost:{port}"))'
  run('sandbox-profile-preflight',['/usr/bin/sandbox-exec','-p',profile,'/usr/bin/true'],5)
  run('diagnostic-boundary-check',[NODE,HERE/'test-diagnostics.cjs'],5)
  run('literal-loopback-bind-preflight',['/usr/bin/sandbox-exec','-p',profile,NODE,HERE/'loopback-preflight.cjs',http_port],5)
  password=secrets.token_hex(24);(owned/'password').write_text(password+'\n')
  (owned/'user-password').write_text(secrets.token_hex(24))
  (owned/'auth-secret').write_text(secrets.token_hex(32))
  run('postgres-version',[PG/'postgres','--version'],5)
  need((owned/'postgres-version.log').read_text().startswith('postgres (PostgreSQL) 17.11'),'postgres_version_changed')
  run('initdb',[PG/'initdb','-D',owned/'data','--username=axiom_local_fixture','--pwfile',owned/'password','--auth-local=reject','--auth-host=scram-sha-256','--encoding=UTF8','--locale=C'],45)
  (owned/'ca.cnf').write_text('[req]\ndistinguished_name=dn\nx509_extensions=ca\nprompt=no\n[dn]\nCN=Owned local integration CA\n[ca]\nbasicConstraints=critical,CA:TRUE\nkeyUsage=critical,keyCertSign,cRLSign\n')
  run('ca',[OPENSSL,'req','-x509','-newkey','rsa:2048','-nodes','-sha256','-days','1','-keyout',owned/'ca.key','-out',owned/'ca.crt','-config',owned/'ca.cnf'],15)
  (owned/'leaf.cnf').write_text('[req]\ndistinguished_name=dn\nprompt=no\n[dn]\nCN=Owned loopback PostgreSQL\n')
  (owned/'leaf.ext').write_text('basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=IP:127.0.0.1\n')
  run('csr',[OPENSSL,'req','-new','-newkey','rsa:2048','-nodes','-sha256','-keyout',owned/'server.key','-out',owned/'server.csr','-config',owned/'leaf.cnf'],15)
  run('sign',[OPENSSL,'x509','-req','-in',owned/'server.csr','-CA',owned/'ca.crt','-CAkey',owned/'ca.key','-CAcreateserial','-out',owned/'server.crt','-days','1','-sha256','-extfile',owned/'leaf.ext'],15)
  data=owned/'data'
  (data/'pg_hba.conf').write_text('hostssl all axiom_local_fixture 127.0.0.1/32 scram-sha-256\nhost all all 127.0.0.1/32 reject\nlocal all all reject\n')
  with (data/'postgresql.conf').open('a') as conf:conf.write(f"\nlisten_addresses='127.0.0.1'\nport={port}\nunix_socket_directories=''\nssl=on\nssl_cert_file='{owned}/server.crt'\nssl_key_file='{owned}/server.key'\npassword_encryption='scram-sha-256'\nlogging_collector=off\nlog_connections=off\nlog_statement='none'\nmax_connections=10\nshared_buffers='16MB'\n")
  with log.open('xb') as out:
   server=subprocess.Popen([str(PG/'postgres'),'-D',str(data)],stdin=subprocess.DEVNULL,stdout=out,stderr=subprocess.STDOUT,env=env,cwd=owned,start_new_session=True)
   end=min(deadline,time.monotonic()+15)
   while True:
    limits();need(server.poll() is None,'owned_postgres_start_failed')
    if b'database system is ready to accept connections' in log.read_bytes():break
    need(time.monotonic()<end,'owned_postgres_start_deadline');time.sleep(.05)
   run('compiled-http',['/usr/bin/sandbox-exec','-p',profile,NODE,HERE/'compiled-http.cjs',ROOT,owned,port,http_port],90,{'NODE_EXTRA_CA_CERTS':str(owned/'ca.crt')})
   result=json.loads((owned/'CLIENT-RESULT.json').read_text());need(result.get('accepted') is True,'integration_not_accepted')
   for name,h in manifest['files'].items():need(digest(Path(name))==h,'source_changed_during_integration')
   need(compiled_tree()==manifest['compiledTreeSha256'],'compiled_outputs_changed_after_http')
   limits();accepted=True
 except BaseException as error:failure=str(error) if isinstance(error,RuntimeError) else type(error).__name__
 finally:
  for sig in [signal.SIGINT,signal.SIGTERM,signal.SIGHUP]:signal.signal(sig,signal.SIG_IGN)
  groups_empty=True
  for process in [active,server]:
   try:stop(process)
   except BaseException:groups_empty=False;accepted=False;failure='owned_cleanup_unconfirmed'
  for name in ['password','ca.key','server.key','user-password','auth-secret']:
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
  receipt={'accepted':accepted,'failure':failure,'ownedDirectory':str(owned),'phases':records,'productionAccess':False,'loopbackOnly':True,'nativeAppOrGovernance':False,'ownedProcessGroupsEmpty':groups_empty,'ownedClusterRemoved':not (owned/'data').exists(),'privateKeysRemoved':all(not (owned/n).exists() for n in ['password','ca.key','server.key','user-password','auth-secret'])}
  try:
   (owned/'RESULT.json').write_text(json.dumps(receipt,indent=2)+'\n');(HERE/'RESULT.json').write_text(json.dumps(receipt,indent=2)+'\n')
   print(json.dumps(receipt))
  finally:
   for sig,handler in old_handlers.items():signal.signal(sig,handler)
 return 0 if accepted else 1
if __name__=='__main__':raise SystemExit(main())
