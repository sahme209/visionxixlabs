"""Fixed two-step memory-only ACL unit (PROPOSAL.md 09139ec5...). Root owns each invocation.

Steps, each at most once for the whole unit, never retried:
  compile  one CLT clang compile under platform.sb (30 s, 64 KiB output, +5 s cleanup)
  run      one synthetic in-memory process under platform.sb (10 s, 64 KiB, +5 s cleanup)
`run` requires BINARY-REVIEW.json (frozen binary/map hashes after independent review).
Any unexpected or unknown outcome writes STOPPED.json, which blocks every later step.
"""
import hashlib,json,os,selectors,signal,stat,subprocess,resource,sys,time
from pathlib import Path
sys.dont_write_bytecode=True
os.umask(0o077)
HERE=Path(__file__).resolve().parent
REPO=HERE.parents[3]
ROOT=Path('/Users/sahme209/Library/Application Support/Vision XIX Labs/Axiom Qualification Lab/2026-11-06-native-acl-memory-platform-1')
CLANG='/Library/Developer/CommandLineTools/usr/bin/clang'
SDK='/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk'
PROPOSAL_SHA256='09139ec5566c8cd9220ffc852ef197ff07fadb93e67d24a56458b3c1e0a0b460'
HELPER=REPO/'packages/verified-issuer-runtime/native/protected_acl_empty.h'
HELPER_SHA256='688fe24d8865b9c1a210c395effefdf52471eb64e871e641207659138ddd9f0c'
BINARY=ROOT/'bin'/'acl-memory-platform'
MAP=Path(str(BINARY)+'.map')
EXPECTED_STDOUT=b'PASS real in-memory ACL E0/E1/ED empty=1, explicit allow/deny=0, repeats and cleanup\n'
LIMITS={'compile':30,'run':10}
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def write_new(p,v):
 fd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
 with os.fdopen(fd,'w')as f:json.dump(v,f,sort_keys=True,indent=1);f.write('\n')
def child_limits():resource.setrlimit(resource.RLIMIT_CORE,(0,0))
def verify_inputs():
 frozen=json.loads((HERE/'PACKET.json').read_bytes())
 if sha(REPO/'docs/recovery/2026-11-06/governance-native-acl-platform-proposal/PROPOSAL.md')!=PROPOSAL_SHA256:raise RuntimeError('proposal_changed')
 if sha(HELPER)!=HELPER_SHA256:raise RuntimeError('production_helper_changed')
 for rel,h in frozen['inputs'].items():
  if sha(HERE/rel)!=h:raise RuntimeError('packet_input_changed:'+rel)
 b=json.loads((REPO/'docs/recovery/2026-11-06/governance-native-acl-platform-proposal/SDK-SOURCE-BINDINGS.json').read_bytes())
 for e in b['sourceTextAndHeaderBindings']:
  if 'protected_acl_empty' in e['path']:continue
  if sha(e['path'])!=e['sha256']:raise RuntimeError('sdk_binding_changed')
 return frozen
def argv(step):
 profile=str(HERE/'platform.sb')
 if step=='compile':
  return ['/usr/bin/sandbox-exec','-f',profile,CLANG,'-std=c11','-Wall','-Wextra','-Werror','-fno-modules','-O0',
   '-arch','arm64','-mmacosx-version-min=13.0','-isysroot',SDK,'-I',str(HELPER.parent),
   str(HERE/'acl_memory_platform.c'),'-o',str(BINARY),'-Wl,-map,'+str(MAP)]
 return ['/usr/bin/sandbox-exec','-f',profile,str(BINARY)]
def main():
 if len(sys.argv)!=2 or sys.argv[1]not in LIMITS:raise RuntimeError('fixed_step_required')
 step=sys.argv[1];verify_inputs();guard=None
 parent=ROOT.parent
 if ROOT.resolve()!=ROOT or any(p.is_symlink()for p in ROOT.parents):raise RuntimeError('canonical_root_required')
 if not parent.exists():parent.mkdir(mode=0o700,parents=True)
 if parent.lstat().st_uid!=os.getuid()or stat.S_IMODE(parent.lstat().st_mode)!=0o700:raise RuntimeError('private_parent_required')
 if not ROOT.exists():ROOT.mkdir(mode=0o700)
 if ROOT.is_symlink()or stat.S_IMODE(ROOT.stat().st_mode)!=0o700 or ROOT.stat().st_uid!=os.getuid():raise RuntimeError('private_root_required')
 if (ROOT/'STOPPED.json').exists():raise RuntimeError('unit_stopped_no_retry')
 claim=ROOT/(step+'.claim.json');terminal=ROOT/(step+'.terminal.json')
 if claim.exists():raise RuntimeError('step_already_consumed_no_retry')
 if step=='run':
  if not (ROOT/'compile.terminal.json').exists()or not json.loads((ROOT/'compile.terminal.json').read_bytes())['matchedExpectedOutcome']:raise RuntimeError('accepted_compile_required')
  review=HERE/'BINARY-REVIEW.json'
  if not review.exists():raise RuntimeError('independent_binary_review_required')
  r=json.loads(review.read_bytes())
  if r.get('result')!='PASS' or r.get('runtimeAuthorizedByUser') is not True:raise RuntimeError('binary_review_or_user_go_ahead_missing')
  sys.path.insert(0,str(HERE));from binary_guard import inspect
  guard=inspect(BINARY)
  if guard['sha256']!=r['binarySha256']or sha(MAP)!=r['mapSha256']:raise RuntimeError('reviewed_binary_changed')
 for name in ('bin','tmp','cache'):
  p=ROOT/name
  if not p.exists():p.mkdir(mode=0o700)
  if p.is_symlink()or p.stat().st_uid!=os.getuid()or stat.S_IMODE(p.stat().st_mode)!=0o700:raise RuntimeError('private_subdirectory_required')
 if step=='compile' and (BINARY.exists()or MAP.exists()):raise RuntimeError('fresh_outputs_required')
 cmd=argv(step);limit=LIMITS[step]
 write_new(claim,{'step':step,'argv':cmd,'limits':{'seconds':limit,'bytes':65536,'cleanupSeconds':5},'preexecBinaryGuard':guard,'proposalSha256':PROPOSAL_SHA256,'retryAuthorized':False,'claimedAtUnix':time.time()})
 started=time.monotonic();deadline=started+limit;p=None;sel=None;streams={'stdout':bytearray(),'stderr':bytearray()};state='completed';error=False;cleanup='unknown'
 try:
  p=subprocess.Popen(cmd,cwd=str(ROOT),stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env={'PATH':'/usr/bin:/bin','LANG':'C','LC_ALL':'C','TMPDIR':str(ROOT/'tmp'),'HOME':str(ROOT),'CLANG_MODULE_CACHE_PATH':str(ROOT/'cache')},start_new_session=True,close_fds=True,preexec_fn=child_limits)
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
  matched=not unknown and code==0
  outputs=None
  if step=='compile' and matched:
   try:
    outputs={}
    for a in (BINARY,MAP):
     s=a.lstat()
     if not stat.S_ISREG(s.st_mode)or s.st_nlink!=1 or s.st_uid!=os.getuid()or not 0<s.st_size<=1024*1024:raise RuntimeError('bounded_owned_output_required')
     outputs[a.name]={'sha256':sha(a),'size':s.st_size}
   except BaseException:matched=False
  if step=='run':matched=matched and bytes(streams['stdout'])==EXPECTED_STDOUT and not streams['stderr']
  for key,value in streams.items():(ROOT/(step+'.'+key+'.log')).write_bytes(value)
  result={'step':step,'state':state,'exit':code,'matchedExpectedOutcome':matched,'activeSeconds':round(active,3),'cleanup':cleanup,'unknown':unknown,'outputs':outputs,'stdout':bytes(streams['stdout']).decode('ascii','replace')[:200] if step=='run' else None,'retryAuthorized':False,'descendantQuiescence':'unavailable'}
  if not matched:write_new(ROOT/'STOPPED.json',{'reason':'unexpected_or_unknown_outcome','step':step,'automaticRetryAuthorized':False})
  write_new(terminal,result)
 if not matched:raise RuntimeError('unit_stopped_no_retry:'+step)
 print('EXPECTED_OUTCOME_RECORDED '+step)
if __name__=='__main__':main()
