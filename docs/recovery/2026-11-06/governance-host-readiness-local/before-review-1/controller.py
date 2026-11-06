"""Fixed one-shot controller; raw worker stderr is never persisted or forwarded."""
import hashlib,json,os,selectors,signal,stat,subprocess,sys,time
from pathlib import Path
sys.dont_write_bytecode=True
os.umask(0o077)
HERE=Path(__file__).parent
PACKET=HERE/'INPUTS.json'
PACKET_SHA256='5a2865249743b097e1ddcd97c10f4e30c28290fee0fa964e4f54fcde4e9f45ec'
OUTPUT=Path('/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Qualification Lab/2026-11-06-governance-host-readiness-1')
WALL_SECONDS=120
CAP=1048576
def write_new(path,value):
 fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
 with os.fdopen(fd,'w')as f:json.dump(value,f,sort_keys=True);f.write('\n')
def main():
 started=time.monotonic();deadline=started+WALL_SECONDS
 if len(sys.argv)!=1:raise RuntimeError('fixed_entry_required')
 data=PACKET.read_bytes()
 if hashlib.sha256(data).hexdigest()!=PACKET_SHA256:raise RuntimeError('fixed_packet_changed')
 config=json.loads(data)
 for binding in config['sourceBindings']:
  p=Path(binding['path']);s=p.lstat()
  if not stat.S_ISREG(s.st_mode)or s.st_nlink!=1 or stat.S_IMODE(s.st_mode)!=binding['mode']or hashlib.sha256(p.read_bytes()).hexdigest()!=binding['sha256']or s.st_size!=binding['size']:raise RuntimeError('frozen_source_changed')
 if OUTPUT.resolve()!=OUTPUT or any(p.is_symlink()for p in OUTPUT.parents):raise RuntimeError('canonical_output_required')
 s=OUTPUT.parent.lstat()
 if not stat.S_ISDIR(s.st_mode)or s.st_uid!=os.getuid()or stat.S_IMODE(s.st_mode)!=0o700:raise RuntimeError('private_parent_required')
 OUTPUT.mkdir(mode=0o700)
 write_new(OUTPUT/'claimed.json',{'packetSha256':PACKET_SHA256,'attempts':1,'retryAuthorized':False,'executionAuthorized':False})
 if signal.getsignal(signal.SIGCHLD)!=signal.SIG_DFL:raise RuntimeError('exclusive_child_reaping_required')
 p=None;sel=None;streams={'stdout':bytearray(),'stderr':bytearray()};state='completed';error=False;cleanup='unknown'
 try:
  p=subprocess.Popen(['/usr/bin/python3','-B',str(HERE/'inspector.py'),'--fixed-private-worker'],stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env={'PATH':'/usr/bin:/bin','LANG':'C','LC_ALL':'C','AX_FIXED_READINESS_DEADLINE':str(deadline)},start_new_session=True,close_fds=True)
  write_new(OUTPUT/'process.json',{'pid':p.pid,'originalProcessGroup':p.pid})
  sel=selectors.DefaultSelector()
  for name,pipe in [('stdout',p.stdout),('stderr',p.stderr)]:os.set_blocking(pipe.fileno(),False);sel.register(pipe,selectors.EVENT_READ,name)
  # Keep direct child unreaped until EOF; no numeric-group signals after wait.
  while sel.get_map():
   if time.monotonic()>=deadline:state='wall_bound';break
   for key,_ in sel.select(min(.05,max(0,deadline-time.monotonic()))):
    remaining=CAP-sum(map(len,streams.values()));chunk=os.read(key.fd,min(4096,remaining+1))
    if not chunk:sel.unregister(key.fileobj);continue
    streams[key.data].extend(chunk[:remaining])
    if len(chunk)>remaining:state='output_bound';break
   if state!='completed':break
  if state=='completed':
   try:p.wait(timeout=max(.001,deadline-time.monotonic()))
   except subprocess.TimeoutExpired:state='wall_bound'
 except BaseException:state='monitor_or_launch_failure';error=True
 finally:
  if p is not None:
   if p.returncode is None:
    try:os.killpg(p.pid,signal.SIGKILL)
    except ProcessLookupError:pass
    except BaseException:error=True
    try:p.wait(timeout=5)
    except BaseException:error=True
   cleanup='reaped_original_worker'if p.returncode is not None else'unknown'
   for pipe in (p.stdout,p.stderr):
    try:pipe.close()
    except BaseException:error=True
  if sel is not None:sel.close()
  # Raw worker stderr is PRIVATE MEMORY ONLY, including unexpected tracebacks.
  worker=None
  if state=='completed'and not error and not streams['stderr']:
   try:
    worker=json.loads(streams['stdout'])
    if not isinstance(worker,dict)or worker.get('format')!='axiom.nonsecret-host-readiness/1':worker=None
   except BaseException:worker=None
  counts={k:len(v)for k,v in streams.items()};streams.clear()
  if worker is not None:write_new(OUTPUT/'observation.json',worker)
  result={'state':state,'workerExit':p.returncode if p is not None else None,'elapsedSeconds':time.monotonic()-started,'bytes':counts,'monitorError':error,'cleanup':cleanup,'safeObservationSaved':worker is not None,'descendantQuiescence':'unavailable','installationReady':False,'activationAllowed':False,'executionAuthorized':False,'retryAuthorized':False}
  write_new(OUTPUT/'result.json',result)
 if state!='completed'or error or p is None or p.returncode!=0 or worker is None:raise RuntimeError('readonly_inspection_stopped_no_retry')
 print('COMPLETE nonsecret_host_inventory_observed_unqualified')
if __name__=='__main__':main()
