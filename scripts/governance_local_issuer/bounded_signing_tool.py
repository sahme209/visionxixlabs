"""Bound stdout/stderr, not the signer's artifact writes. No automatic retries."""
import os,selectors,signal,subprocess,time
CAP=65536
SECONDS=10
def run(argv,cwd,environment):
 if signal.getsignal(signal.SIGCHLD)!=signal.SIG_DFL:raise ValueError('exclusive_child_reaper_required')
 process=None;selector=None;output=bytearray();state='completed';cleanup='not_started';error=None
 start=time.monotonic()
 try:
  process=subprocess.Popen(argv,cwd=cwd,env=environment,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
  selector=selectors.DefaultSelector()
  for name,pipe in (('stdout',process.stdout),('stderr',process.stderr)):
   os.set_blocking(pipe.fileno(),False);selector.register(pipe,selectors.EVENT_READ,name)
  while selector.get_map():
   remaining=SECONDS-(time.monotonic()-start)
   if remaining<=0:state='timeout';break
   for key,_ in selector.select(min(.1,remaining)):
    try:part=os.read(key.fileobj.fileno(),min(4096,CAP-len(output)+1))
    except BlockingIOError:continue
    if not part:selector.unregister(key.fileobj);continue
    room=CAP-len(output);output.extend(part[:room])
    if len(part)>room:state='output_bound';break
   if state!='completed':break
  if state=='completed':
   remaining=SECONDS-(time.monotonic()-start)
   if remaining<=0:state='timeout'
   else:
    try:process.wait(timeout=remaining)
    except subprocess.TimeoutExpired:state='timeout'
 except BaseException as exc:state='monitor_or_launch_error';error=type(exc).__name__
 finally:
  if process is not None:
   try:
    if process.poll()is None:
     # Only the original unreaped child proves ownership of this group number.
     try:os.killpg(process.pid,signal.SIGKILL)
     except ProcessLookupError:pass
     process.wait(timeout=5)
    cleanup='reaped_original_child'
   except BaseException as exc:cleanup='unknown';error=error or type(exc).__name__
   for pipe in (process.stdout,process.stderr):
    try:pipe.close()
    except BaseException as exc:cleanup='unknown';error=error or type(exc).__name__
  if selector is not None:
   try:selector.close()
   except BaseException as exc:cleanup='unknown';error=error or type(exc).__name__
 if cleanup!='reaped_original_child':state='unknown'
 return {'exit':process.returncode if process is not None else None,'state':state,'cleanup':cleanup,'error':error,'output':bytes(output),'descendantQuiescence':'unavailable'}
