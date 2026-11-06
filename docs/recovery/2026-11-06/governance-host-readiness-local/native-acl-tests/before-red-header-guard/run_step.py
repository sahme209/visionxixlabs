"""Fixed reviewed stub-test steps; root owns every actual invocation."""
import hashlib,json,os,selectors,signal,stat,subprocess,resource,sys,time
from pathlib import Path
sys.dont_write_bytecode=True
os.umask(0o077)
HERE=Path(__file__).parent
PACKET_SHA256='599c7fc91b930f1666942d7ff0a690a229db0c3c70a5e52111e68cdf54fb2c6f'
REVIEWED_RED_BINARY_SHA256='PENDING_ACTUAL_COMPILED_IMPORT_REVIEW'
ROOT=Path('/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Qualification Lab/2026-11-06-native-acl-stub-tests-1')
def write_new(p,v):
 fd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
 with os.fdopen(fd,'w')as f:json.dump(v,f,sort_keys=True);f.write('\n')
def bound(p):
 s=p.lstat()
 if not stat.S_ISREG(s.st_mode)or s.st_nlink!=1:raise RuntimeError('fixed_regular_binding_required')
 return {'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'size':s.st_size,'mode':stat.S_IMODE(s.st_mode)}
def child_limits():resource.setrlimit(resource.RLIMIT_CORE,(0,0))
def main():
 if len(sys.argv)!=2 or sys.argv[1]not in ('red-caller-compile','red-caller-test'):raise RuntimeError('fixed_reviewed_step_required')
 step=sys.argv[1];guard=None;packet_path=HERE/'RECIPES.json'
 if bound(packet_path)['sha256']!=PACKET_SHA256:raise RuntimeError('frozen_recipe_packet_changed')
 config=json.loads(packet_path.read_bytes())
 for x in config['bindings']:
  got=bound(Path(x['path']))
  if any(got[k]!=x[k]for k in ('sha256','size','mode')):raise RuntimeError('frozen_harness_input_changed')
 if ROOT.resolve()!=ROOT or any(p.is_symlink()for p in ROOT.parents):raise RuntimeError('canonical_test_root_required')
 parent=ROOT.parent.lstat()
 if parent.st_uid!=os.getuid()or stat.S_IMODE(parent.st_mode)!=0o700:raise RuntimeError('private_parent_required')
 if not ROOT.exists():ROOT.mkdir(mode=0o700)
 if ROOT.is_symlink()or stat.S_IMODE(ROOT.stat().st_mode)!=0o700 or ROOT.stat().st_uid!=os.getuid():raise RuntimeError('private_test_root_required')
 if (ROOT/'STOPPED.json').exists():raise RuntimeError('unknown_or_failed_unit_stopped')
 totals=0.;count=0;seen=set()
 for n in range(1,33):
  claim=ROOT/('attempt-%02d.claim.json'%n);terminal=ROOT/('attempt-%02d.terminal.json'%n)
  if not claim.exists():break
  if not terminal.exists():raise RuntimeError('prior_outcome_unknown_no_retry')
  r=json.loads(terminal.read_bytes());c=json.loads(claim.read_bytes());count+=1;totals+=r['activeSeconds'];seen.add(c['step'])
  if r['unknown']:raise RuntimeError('prior_outcome_unknown_no_retry')
 if count>=32 or totals>=480 or step in seen:raise RuntimeError('unit_limit_or_consumed_step')
 if step=='red-caller-test':
  if 'red-caller-compile'not in seen:raise RuntimeError('compile_before_test_required')
  if len(REVIEWED_RED_BINARY_SHA256)!=64:raise RuntimeError('actual_import_map_review_required_before_test')
  from binary_guard import inspect
  binary=ROOT/'red/caller-test';guard=inspect(binary)
  if guard['sha256']!=REVIEWED_RED_BINARY_SHA256:raise RuntimeError('reviewed_test_binary_changed')
  if bound(ROOT/'red/caller-test.map')['sha256']!=config.get('reviewedMapSha256'):raise RuntimeError('actual_link_map_review_required')
 lock=ROOT/'active.lock';lockfd=os.open(lock,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600);os.close(lockfd)
 for name in ('red','tmp','cache'):
  p=ROOT/name
  if not p.exists():p.mkdir(mode=0o700)
  if p.is_symlink()or p.stat().st_uid!=os.getuid()or stat.S_IMODE(p.stat().st_mode)!=0o700:raise RuntimeError('private_test_subdirectory_required')
 if step=='red-caller-compile'and ((ROOT/'red/caller-test').exists()or(ROOT/'red/caller-test.map').exists()):raise RuntimeError('fresh_compiler_outputs_required')
 argv=config['steps'][step]['argv'];expected=config['steps'][step]['expectedExit'];attempt=count+1
 write_new(ROOT/('attempt-%02d.claim.json'%attempt),{'step':step,'packetSha256':PACKET_SHA256,'argv':argv,'attempt':attempt,'testBinaryPreexec':guard,'limits':{'seconds':min(30,480-totals),'bytes':65536,'cleanupSeconds':5},'retryAuthorized':False})
 started=time.monotonic();deadline=started+min(30,480-totals);p=None;sel=None;streams={'stdout':bytearray(),'stderr':bytearray()};state='completed';error=False;active=0.;cleanup='unknown'
 try:
  p=subprocess.Popen(argv,cwd=str(ROOT),stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env={'PATH':'/usr/bin:/bin','LANG':'C','LC_ALL':'C','TMPDIR':str(ROOT/'tmp'),'HOME':str(ROOT),'CLANG_MODULE_CACHE_PATH':str(ROOT/'cache')},start_new_session=True,close_fds=True,preexec_fn=child_limits)
  sel=selectors.DefaultSelector()
  for key,pipe in [('stdout',p.stdout),('stderr',p.stderr)]:os.set_blocking(pipe.fileno(),False);sel.register(pipe,selectors.EVENT_READ,key)
  while sel.get_map():
   if time.monotonic()>=deadline:state='time_bound';break
   for key,_ in sel.select(min(.05,max(0,deadline-time.monotonic()))):
    remaining=65536-sum(map(len,streams.values()));data=os.read(key.fd,min(4096,remaining+1))
    if not data:sel.unregister(key.fileobj);continue
    streams[key.data].extend(data[:remaining])
    if len(data)>remaining:state='output_bound';break
   if state!='completed':break
  if state=='completed':
   try:p.wait(timeout=max(.001,deadline-time.monotonic()))
   except subprocess.TimeoutExpired:state='time_bound'
 except BaseException:state='monitor_or_launch_unknown';error=True
 finally:
  active=time.monotonic()-started
  if p is not None:
   if p.returncode is None:
    try:os.killpg(p.pid,signal.SIGKILL)
    except ProcessLookupError:pass
    except BaseException:error=True
    try:p.wait(timeout=5)
    except BaseException:error=True
   cleanup='reaped_original_child'if p.returncode is not None else'unknown'
   for pipe in (p.stdout,p.stderr):pipe.close()
  if sel is not None:sel.close()
  code=p.returncode if p is not None else None
  unknown=error or state!='completed'or cleanup!='reaped_original_child'or code is None or code<0
  matched=not unknown and code==expected
  if step=='red-caller-compile'and matched:
   try:
    for artifact in (ROOT/'red/caller-test',ROOT/'red/caller-test.map'):
     a=artifact.lstat()
     if not stat.S_ISREG(a.st_mode)or a.st_nlink!=1 or a.st_uid!=os.getuid()or not 0<a.st_size<=1024*1024:raise RuntimeError('bounded_owned_compiler_output_required')
   except BaseException:matched=False
  if step=='red-caller-test':matched=matched and bytes(streams['stdout'])==b'FAIL nonempty ACL reached guarded effect\n'and not streams['stderr']
  for key,value in streams.items():(ROOT/('attempt-%02d.%s.log'%(attempt,key))).write_bytes(value)
  result={'step':step,'state':state,'exit':code,'expectedExit':expected,'matchedExpectedOutcome':matched,'activeSeconds':active,'totalWallSeconds':time.monotonic()-started,'cleanup':cleanup,'unknown':unknown,'descendantQuiescence':'unavailable','installationReady':False,'executionAuthorized':False,'retryAuthorized':False}
  if not matched:write_new(ROOT/'STOPPED.json',{'reason':'unexpected_or_unknown_outcome','attempt':attempt,'automaticRetryAuthorized':False})
  write_new(ROOT/('attempt-%02d.terminal.json'%attempt),result)
  lock.unlink()
 if not matched:raise RuntimeError('stub_test_unit_stopped_no_retry')
 print('EXPECTED_OUTCOME_RECORDED '+step)
if __name__=='__main__':main()
