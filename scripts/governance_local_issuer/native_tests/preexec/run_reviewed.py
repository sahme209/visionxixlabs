"""Not run by preparation. Requires a fresh explicit approval for this exact manifest."""
from pathlib import Path
import hashlib,json,os,secrets,signal,subprocess,sys,selectors,time
if sys.argv[1:]!=['--run-exact-reviewed-preexec-fixture']:raise SystemExit('Execution disabled; exact reviewed opt-in required')
build=Path(__file__).resolve().parent
manifest=json.loads((build/'manifest.json').read_text())
if manifest['artifact_root']!=str(build):raise SystemExit('artifact_root_changed')
for name,digest in manifest['files'].items():
 if '/' in name or hashlib.sha256((build/name).read_bytes()).hexdigest()!=digest:raise SystemExit('artifact_changed')
node=Path(manifest['node'])
if hashlib.sha256(node.read_bytes()).hexdigest()!=manifest['node_sha256']:raise SystemExit('node_changed')
# One exact experiment claim is consumed even if a child, cleanup, or recording fails.
claim=os.open(build/'run-claim.json',os.O_CREAT|os.O_EXCL|os.O_WRONLY|os.O_NOFOLLOW,0o600)
os.write(claim,b'{"status":"claimed_no_retry"}\n');os.fsync(claim);os.close(claim)
terminal='unknown_no_retry'
try:
 (build/'bootstrap').chmod(0o700)
 results=[]
 for mode in ('control','restricted'):
  root=Path('/private/tmp')/('axiom-preexec-owned-'+secrets.token_hex(4));root.mkdir(mode=0o700)
  for name in ('path-write','mapping'):
   fd=os.open(root/name,os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW|os.O_WRONLY,0o600)
   os.write(fd,b'0'*os.sysconf('SC_PAGESIZE'));os.close(fd)
  before={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in root.iterdir()}
  with open('/dev/null','rb') as inp:
   child=subprocess.Popen([str(build/'bootstrap'),mode,str(root)],stdin=inp,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env={'PATH':'/usr/bin:/bin','LANG':'C','LC_ALL':'C'},close_fds=True,start_new_session=True)
   selector=selectors.DefaultSelector(); buffers={'stdout':bytearray(),'stderr':bytearray()};overflow=False;deadline=time.monotonic()+15
   for name,stream in [('stdout',child.stdout),('stderr',child.stderr)]:selector.register(stream,selectors.EVENT_READ,name)
   while selector.get_map() and time.monotonic()<deadline and not overflow:
    for key,_ in selector.select(timeout=min(.1,max(0,deadline-time.monotonic()))):
     chunk=os.read(key.fileobj.fileno(),4096)
     if not chunk:selector.unregister(key.fileobj);key.fileobj.close();continue
     target=buffers[key.data]
     if len(target)+len(chunk)>8192:overflow=True;break
     target.extend(chunk)
   timed_out=bool(selector.get_map()) and not overflow
   if timed_out or overflow:
    try:os.killpg(child.pid,signal.SIGKILL)
    except ProcessLookupError:pass
   try:child.wait(timeout=3)
   except subprocess.TimeoutExpired:
    timed_out=True
    try:os.killpg(child.pid,signal.SIGKILL)
    except ProcessLookupError:pass
    try:child.wait(timeout=3)
    except subprocess.TimeoutExpired:raise SystemExit('owned_child_unreaped_unknown')
   for key in list(selector.get_map().values()):key.fileobj.close()
   selector.close();stdout=bytes(buffers['stdout']);stderr=bytes(buffers['stderr'])
  after={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in root.iterdir()}
  result={'mode':mode,'root':str(root),'returncode':child.returncode,'stdout':stdout[:8192].decode(errors='replace'),'stderr':stderr[:8192].decode(errors='replace'),'output_overflow':overflow,'timed_out':timed_out,'before':before,'after':after}
  results.append(result)
  # Preserve owned seeds and exact observations for independent readback; never reuse roots.
 with (build/'run-result.json').open('x') as result_file:result_file.write(json.dumps({'results':results,'identity':'unavailable','qualification':'feasibility_only'},indent=2)+'\n')
 terminal='completed_observations_not_qualification'
 print(str(build/'run-result.json'))
finally:
 (build/'bootstrap').chmod(0o600)
 with (build/'run-terminal.json').open('x') as terminal_file:terminal_file.write(json.dumps({'status':terminal,'claim_consumed':True,'retry_allowed':False})+'\n')
