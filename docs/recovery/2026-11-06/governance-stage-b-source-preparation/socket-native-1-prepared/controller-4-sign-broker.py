"""One-run ordinary build controller. Prepared only; execution requires approval.
Kills only its own driver's original process group on bounds; descendants remain
unqualified. No generic process discovery, PID adoption, retry or issuer claim.
"""
import hashlib,json,os,selectors,signal,stat,subprocess,sys,time
from pathlib import Path
sys.dont_write_bytecode=True
# Only approved entrypoint: establish private creation mask before writes/spawn.
os.umask(0o077)
DRIVER=Path('/Users/samirahmed/Documents/Codex/2026-10-29/axiom-ticket-install-completion/docs/recovery/2026-11-06/governance-stage-b-source-preparation/socket-native-1-prepared/step-4-sign-broker.py')
DRIVER_SHA256='47e0fec59d9ae68839f3ac984b1fc331ded0f9f3f367783aeaab081438b1327f'
CONTROL=Path('/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Qualification Lab/2026-11-06-stage-b-socket-native-controller-4-sign-broker')
WALL_SECONDS=120
OUTPUT_BYTES=1024*1024
def main():
 if len(sys.argv)!=1 or hashlib.sha256(DRIVER.read_bytes()).hexdigest()!=DRIVER_SHA256:raise RuntimeError('fixed_controller_driver_required')
 if CONTROL.resolve()!=CONTROL or any(p.is_symlink()for p in CONTROL.parents):raise RuntimeError('canonical_control_path_required')
 s=CONTROL.parent.lstat()
 if not stat.S_ISDIR(s.st_mode)or s.st_uid!=os.getuid()or stat.S_IMODE(s.st_mode)!=0o700:raise RuntimeError('private_control_parent_required')
 CONTROL.mkdir(mode=0o700)
 if stat.S_IMODE(CONTROL.stat().st_mode)!=0o700:raise RuntimeError('private_control_creation_required')
 (CONTROL/'claimed.json').write_text(json.dumps({'driverSha256':DRIVER_SHA256,'attempts':1,'retryAuthorized':False,'executionAuthorized':False})+'\n')
 if signal.getsignal(signal.SIGCHLD)!=signal.SIG_DFL:raise RuntimeError('exclusive_child_reaping_required')
 started=time.monotonic();p=None;selector=None;streams={'stdout':bytearray(),'stderr':bytearray()};state='completed';monitor_error=None;cleanup='not_started'
 try:
  p=subprocess.Popen(['/usr/bin/python3','-B',str(DRIVER)],stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env={'PATH':'/usr/bin:/bin:/usr/sbin:/sbin','HOME':str(Path.home()),'LANG':'C','LC_ALL':'C'},start_new_session=True)
  (CONTROL/'process.json').write_text(json.dumps({'pid':p.pid,'originalProcessGroup':p.pid,'driverSha256':DRIVER_SHA256})+'\n')
  selector=selectors.DefaultSelector()
  for name,pipe in [('stdout',p.stdout),('stderr',p.stderr)]:os.set_blocking(pipe.fileno(),False);selector.register(pipe,selectors.EVENT_READ,name)
  # Do not poll/reap while pipes are held. The direct child stays owned and its
  # numeric PID cannot be reused before our sole wait, even after it exits.
  while selector.get_map():
   if time.monotonic()-started>=WALL_SECONDS:state='wall_bound';break
   for key,_ in selector.select(.1):
    remaining=OUTPUT_BYTES-sum(map(len,streams.values()))
    chunk=os.read(key.fileobj.fileno(),min(4096,remaining+1))
    if not chunk:selector.unregister(key.fileobj);continue
    accepted=chunk[:remaining];streams[key.data].extend(accepted)
    if key.data=='stdout'and accepted:sys.stdout.buffer.write(accepted);sys.stdout.buffer.flush()
    if len(chunk)>remaining:state='output_bound';break
   if state!='completed':break
  if state=='completed':
   try:p.wait(timeout=max(.001,WALL_SECONDS-(time.monotonic()-started)))
   except subprocess.TimeoutExpired:state='wall_bound'
 except BaseException as error:
  state='monitoring_or_launch_error';monitor_error=type(error).__name__
 finally:
  # Never signal a numeric group after our wait has reaped its leader. No other
  # thread, handler or poll in this controller reaps this exact direct child.
  if p is not None:
   if p.returncode is None:
    try:os.killpg(p.pid,signal.SIGKILL)
    except ProcessLookupError:pass
    except BaseException as error:monitor_error=monitor_error or type(error).__name__
    try:p.wait(timeout=5)
    except BaseException as error:monitor_error=monitor_error or type(error).__name__
   cleanup='reaped_original_driver'if p.returncode is not None else'unknown'
   for pipe in (p.stdout,p.stderr):
    try:pipe.close()
    except BaseException as error:monitor_error=monitor_error or type(error).__name__
  if selector is not None:
   try:selector.close()
   except BaseException as error:monitor_error=monitor_error or type(error).__name__
  # Best-effort persistence even on read/forward/wait failures. A storage failure
  # is unknown and must not be transformed into a successful build or a retry.
  persistence_error=None
  for name,data in streams.items():
   try:(CONTROL/(name+'.log')).write_bytes(data)
   except BaseException as error:persistence_error=type(error).__name__
  result={'state':state,'driverExit':p.returncode if p is not None else None,'elapsedSeconds':time.monotonic()-started,'bytes':{name:len(value)for name,value in streams.items()},'monitorErrorType':monitor_error,'persistenceErrorType':persistence_error,'originalDriverCleanup':cleanup,'descendantQuiescence':'unavailable','executionAuthorized':False,'installationReady':False,'retryAuthorized':False}
  try:(CONTROL/'result.json').write_text(json.dumps(result)+'\n')
  except BaseException:raise RuntimeError('controller_terminal_persistence_unknown') from None
 if state!='completed'or monitor_error is not None or persistence_error is not None or p is None or p.returncode!=0:raise RuntimeError('ordinary_build_attempt_stopped_no_retry')
if __name__=='__main__':main()
