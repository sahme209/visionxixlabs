#!/usr/bin/env python3
"""Exercise Axiom's low-level client against an owned loopback Airflow3.3.2 no-op.
Run with the private Airflow virtual environment's Python (psutil is required).
No external service URL, cloud key or production database is accepted.
"""
import sys,argparse,os,subprocess,tempfile,json,secrets,socket,time,signal,shutil,datetime,urllib.request,urllib.error,threading
from pathlib import Path
import psutil
os.umask(0o077)
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--airflow-venv',required=True)
parser.add_argument('--output-dir',required=True)
parser.add_argument('--node',required=True)
parser.add_argument('--pg-bin-dir',help='Optional PG17 directory for combined scheduler/database/engine acceptance')
args=parser.parse_args()
repo=Path(__file__).resolve().parents[1];base=Path(args.output_dir).expanduser().resolve();base.mkdir(parents=True,mode=0o700)
if base.stat().st_mode & 0o077 or base.stat().st_uid != os.getuid():raise RuntimeError('private_owned_output_required')
venv=Path(args.airflow_venv).expanduser().resolve();node=str(Path(args.node).resolve())
private_tmp='/private/tmp' if Path('/private/tmp').is_dir() else '/tmp'
version=subprocess.run([str(venv/'bin/python'),'-c','import importlib.metadata;print(importlib.metadata.version("apache-airflow"))'],capture_output=True,text=True,check=True).stdout.strip()
if version!='3.3.2':raise RuntimeError('pinned_airflow_3_3_2_required')
owned=Path(tempfile.mkdtemp(prefix='axiom-airflow-engine-',dir=private_tmp)).resolve();home=owned/'home';dags=home/'dags';dags.mkdir(parents=True,mode=0o700)
with socket.socket() as probe:probe.bind(('127.0.0.1',0));port=probe.getsockname()[1]
origin='http://127.0.0.1:'+str(port);dagid='axiom_owned_noop_'+secrets.token_hex(8);password=secrets.token_urlsafe(32);pwfile=owned/'passwords.private.json';pwfile.write_text(json.dumps({'axiom_fixture':password}));os.chmod(pwfile,0o600)
(dags/'owned_noop.py').write_text('''from airflow.sdk import dag, task
from datetime import datetime, timezone
@dag(dag_id="'''+dagid+'''", schedule=None, start_date=datetime(2026,1,1,tzinfo=timezone.utc), catchup=False, tags=["axiom_owned_fixture"])
def owned_noop():
    @task
    def read_fixture():
        return {"owned_fixture": True}
    @task
    def confirm_fixture(value):
        assert value == {"owned_fixture": True}
        return "complete"
    confirm_fixture(read_fixture())
owned_noop()
''')
fixture=owned/'fixture.json';fixture.write_text(json.dumps({'baseUrl':origin,'username':'axiom_fixture','password':password,'dagId':dagid,'runId':'axiom_fixture_'+secrets.token_hex(8),'version':'3.3.2'}));os.chmod(fixture,0o600)
env={k:os.environ[k] for k in ['HOME','PATH'] if k in os.environ};env.update(PATH=str(venv/'bin')+':'+env.get('PATH',''),AIRFLOW_HOME=str(home),AIRFLOW__CORE__LOAD_EXAMPLES='false',AIRFLOW__CORE__DAGS_FOLDER=str(dags),AIRFLOW__CORE__DAGS_ARE_PAUSED_AT_CREATION='false',AIRFLOW__CORE__SIMPLE_AUTH_MANAGER_USERS='axiom_fixture:admin',AIRFLOW__CORE__SIMPLE_AUTH_MANAGER_ALL_ADMINS='false',AIRFLOW__CORE__SIMPLE_AUTH_MANAGER_PASSWORDS_FILE=str(pwfile),AIRFLOW__CORE__PARALLELISM='1',AIRFLOW__CORE__MAX_ACTIVE_TASKS_PER_DAG='1',AIRFLOW__CORE__EXECUTOR='LocalExecutor',AIRFLOW__API__HOST='127.0.0.1',AIRFLOW__API__PORT=str(port),AIRFLOW__API__WORKERS='1',AIRFLOW__API__BASE_URL=origin,AIRFLOW__CORE__EXECUTION_API_SERVER_URL=origin+'/execution/',AIRFLOW__API_AUTH__JWT_SECRET=secrets.token_hex(32),AIRFLOW__API__SECRET_KEY=secrets.token_hex(32),AIRFLOW__METRICS__OTEL_ON='false',AIRFLOW__METRICS__STATSD_ON='false',AIRFLOW__DAG_PROCESSOR__REFRESH_INTERVAL='2',NO_COLOR='1',PYTHONNOUSERSITE='1',TMPDIR=private_tmp)
opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
def request(path,data=None,token=None):
 headers={'content-type':'application/json'}
 if token:headers['authorization']='Bearer '+token
 req=urllib.request.Request(origin+path,data=None if data is None else json.dumps(data).encode(),headers=headers)
 with opener.open(req,timeout=4) as response:return json.load(response)
server=None;report=None;log=None
known={};known_lock=threading.Lock();stop_tracking=threading.Event();tracker=None

def remember(process):
 try:
  identity=(process.pid,process.create_time())
  with known_lock:known[identity]=process
 except psutil.NoSuchProcess:pass

def group_members():
 if not server:return []
 members=[]
 for process in psutil.process_iter():
  try:
   if os.getpgid(process.pid)==server.pid and os.getsid(process.pid)==server.pid:
    remember(process);members.append(process)
  except (ProcessLookupError,PermissionError,psutil.NoSuchProcess):pass
 return members

def capture_owned():
 while not stop_tracking.is_set():
  if server:
   try:
    parent=psutil.Process(server.pid)
    if parent.create_time()==start_identity:
     remember(parent)
     for child in parent.children(recursive=True):remember(child)
   except psutil.NoSuchProcess:pass
  with known_lock:parents=list(known.values())
  for parent in parents:
   try:
    if parent.is_running():
     for child in parent.children(recursive=True):remember(child)
   except psutil.NoSuchProcess:pass
  group_members();stop_tracking.wait(0.1)

def active_known():
 with known_lock:processes=list(known.values())
 active=[]
 for process in processes:
  try:
   if process.is_running() and process.status()!=psutil.STATUS_ZOMBIE:active.append(process)
  except psutil.NoSuchProcess:pass
 return active

def signal_owned_group(sig):
 if group_members():
  try:os.killpg(server.pid,sig)
  except ProcessLookupError:pass

try:
 log=(base/'engine.private.log').open('w');os.chmod(base/'engine.private.log',0o600)
 server=subprocess.Popen([str(venv/'bin/airflow'),'standalone'],env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True);start_identity=psutil.Process(server.pid).create_time();(base/'owned-engine-state.json').write_text(json.dumps({'pid':server.pid,'processCreatedAt':start_identity,'port':port,'dagId':dagid,'credentialsPrivate':True}))
 tracker=threading.Thread(target=capture_owned,daemon=True);tracker.start()
 deadline=time.monotonic()+180;ready=False
 while time.monotonic()<deadline:
  if server.poll() is not None:raise RuntimeError('owned_airflow_server_exited')
  try:
   auth=request('/auth/token',{'username':'axiom_fixture','password':password});token=auth.get('access_token');assert token
   dag=request('/api/v2/dags/'+dagid,token=token)
   if dag.get('dag_id')==dagid:ready=True;break
  except (OSError,ValueError,AssertionError):pass
  time.sleep(1)
 if not ready:raise RuntimeError('owned_airflow_readiness_deadline_see_private_log')
 print('Owned loopback Airflow authenticated; no-op DAG discovered; running application adapter acceptance',flush=True)
 testenv={k:env[k] for k in ['HOME','PATH','TMPDIR']};testenv.update(AXIOM_OWNED_AIRFLOW_FIXTURE=str(fixture),NODE_OPTIONS='--max-old-space-size=8192')
 tested=subprocess.run([node,'node_modules/vitest/vitest.mjs','run','lib/integrations/airflow/__tests__/airflowClient.engine.test.ts','--reporter=json','--outputFile='+str(base/'adapter-results.json')],cwd=repo,env=testenv,capture_output=True,text=True,timeout=200)
 (base/'adapter-tests.private.log').write_text(tested.stdout+'\n'+tested.stderr)
 if tested.returncode:raise RuntimeError('owned_airflow_adapter_tests_failed_see_private_log')
 results=json.loads((base/'adapter-results.json').read_text());assert results['numPassedTests']==3 and not results['numFailedTests'] and not results['numPendingTests']
 combined_verified=False
 if args.pg_bin_dir:
  # Every nested fixture operation/test has its own deadline and a database
  # shutdown finally block. Do not kill its owner with an independent shorter
  # timeout while that cleanup may still be running.
  combined=subprocess.run([sys.executable,str(repo/'scripts/test-agent-credit-postgres.py'),'--output-dir',str(base/'combined-postgres'),'--pg-bin-dir',str(Path(args.pg_bin_dir).resolve()),'--node',node,'--airflow-fixture',str(fixture)],cwd=repo,env=testenv,capture_output=True,text=True)
  (base/'combined-scheduler.private.log').write_text(combined.stdout+'\n'+combined.stderr)
  if combined.returncode:raise RuntimeError('combined_scheduler_database_engine_failed_see_private_log')
  combined_receipt=json.loads((base/'combined-postgres/verification.json').read_text())
  assert combined_receipt['combinedRealAirflowSchedulerTestsPassed']==1 and combined_receipt['localClusterRemoved']
  combined_verified=True
 report={'verifiedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'airflowVersion':'3.3.2','realLocalEngine':True,'realProviderClient':True,'testsPassed':3,'testsFailed':0,'onlyLoopback':True,'onlyOwnedNoopDag':True,'productionChanges':False,'cloudActions':False,'providerInference':False,'customerConnectionSaveVerified':False,'privateOriginValidationUnchanged':True,'combinedRealSchedulerDatabaseAcceptance':combined_verified}
finally:
 try:
  if server:
   # The original parent can exit before cleanup. Observe descendants while it
   # lives, retain their PID+creation identities, and include its owned session.
   group_members()
   if server.poll() is None:
    server.send_signal(signal.SIGINT)
    try:server.wait(timeout=20)
    except subprocess.TimeoutExpired:pass
   signal_owned_group(signal.SIGTERM)
   if server.poll() is None:
    try:server.wait(timeout=10)
    except subprocess.TimeoutExpired:pass
   group_members()
   for process in active_known():
    try:process.terminate()
    except psutil.NoSuchProcess:pass
   psutil.wait_procs(active_known(),timeout=5)
   signal_owned_group(signal.SIGKILL)
   for process in active_known():
    try:process.kill()
    except psutil.NoSuchProcess:pass
   if server.poll() is None:server.wait(timeout=5)
   psutil.wait_procs(active_known(),timeout=5)
   stop_tracking.set()
   if tracker:tracker.join(timeout=2)
   group_members()
   if active_known():raise RuntimeError('owned_engine_cleanup_incomplete_files_retained')
   # A live listener is uncertainty even if another local process raced to
   # reuse the port. Never kill an unrelated listener; retain files instead.
   with socket.socket() as probe:
    probe.settimeout(0.3)
    if probe.connect_ex(('127.0.0.1',port))==0:raise RuntimeError('owned_port_not_closed_files_retained')
  if log:log.close()
  shutil.rmtree(owned)
  (base/'cleanup.json').write_text(json.dumps({'ownedProcessesStopped':True,'ownedProcessGroupEmpty':True,'ownedPortClosed':True,'ownedHomeRemoved':True})+'\n')
 finally:
  stop_tracking.set()
  if tracker:tracker.join(timeout=2)

if report:
 report['ownedProcessesStopped']=True;report['ownedProcessGroupEmpty']=True;report['ownedPortClosed']=True;report['ownedHomeRemoved']=True;(base/'verification.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
