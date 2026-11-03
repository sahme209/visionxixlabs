from pathlib import Path
import hashlib,json,os,secrets,signal,subprocess,selectors,time
build=Path('/private/tmp/axiom-preexec-prepared-wj0eyl6j');manifest=json.loads((build/'manifest.json').read_text())
assert hashlib.sha256((build/'manifest.json').read_bytes()).hexdigest()=='0d5ec0c4bcfa0fb2c3d770d32adf0be9b123c9a5a29fb36f996f0ce4e42b665f'
for name,digest in manifest['files'].items():assert hashlib.sha256((build/name).read_bytes()).hexdigest()==digest
assert hashlib.sha256(Path(manifest['node']).read_bytes()).hexdigest()==manifest['node_sha256']
assert not (build/'run-claim.json').exists()
root=Path('/private/tmp')/('axiom-preexec-owned-'+secrets.token_hex(4));root.mkdir(mode=0o700)
for name in ('path-write','mapping'):
 fd=os.open(root/name,os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW|os.O_WRONLY,0o600);os.write(fd,b'0'*os.sysconf('SC_PAGESIZE'));os.close(fd)
before={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in root.iterdir()};buffers={'stdout':bytearray(),'stderr':bytearray()};overflow=False;timed_out=False
try:
 (build/'bootstrap').chmod(0o700)
 with open('/dev/null','rb') as inp:
  child=subprocess.Popen([str(build/'bootstrap'),'control',str(root)],stdin=inp,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env={'PATH':'/usr/bin:/bin','LANG':'C','LC_ALL':'C'},close_fds=True,start_new_session=True)
  selector=selectors.DefaultSelector();deadline=time.monotonic()+15
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
   child.wait(timeout=3)
  for key in list(selector.get_map().values()):key.fileobj.close()
  selector.close()
finally:(build/'bootstrap').chmod(0o600)
after={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in root.iterdir()}
result={'argv':[str(build/'bootstrap'),'control',str(root)],'manifest_sha256':'0d5ec0c4bcfa0fb2c3d770d32adf0be9b123c9a5a29fb36f996f0ce4e42b665f','returncode':child.returncode,'stdout':bytes(buffers['stdout']).decode(errors='replace'),'stderr':bytes(buffers['stderr']).decode(errors='replace'),'overflow':overflow,'timed_out':timed_out,'root':str(root),'before':before,'after':after,'profile_calls':0,'paired_claim_created':(build/'run-claim.json').exists(),'bootstrap_mode':oct((build/'bootstrap').stat().st_mode&0o777)}
Path('work/preexec-control/result.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
