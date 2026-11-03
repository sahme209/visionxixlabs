"""Exact future owned resource experiment. NEVER run by preparation or imports."""
from __future__ import annotations
import hashlib,json,os,re,selectors,signal,stat,subprocess,sys,time
from pathlib import Path
from .protected_fixture import PACKAGE,PACKAGE_DIGEST,claim_once,inspect_alias_pair,prepare_resource_fixture,PackageUnavailable
from .manifest import verify_package
ROOT=Path('/private/tmp/axiom-protected-fixture-prepared-sv2b99jz')

def _run(argv,timeout):
 buffers={'stdout':bytearray(),'stderr':bytearray()};overflow=False;timed_out=False;cleanup_attempted=False
 with open('/dev/null','rb') as inp:
  child=subprocess.Popen(argv,stdin=inp,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env={'PATH':'/usr/bin:/bin:/usr/sbin:/sbin','LANG':'C','LC_ALL':'C'},close_fds=True,start_new_session=True)
  sel=None
  def kill_reap():
   nonlocal cleanup_attempted
   cleanup_attempted=True
   try:os.killpg(child.pid,signal.SIGKILL)
   except ProcessLookupError:pass
   try:child.wait(timeout=3)
   except subprocess.TimeoutExpired:raise PackageUnavailable('owned_child_unreaped_unknown')
  try:
   sel=selectors.DefaultSelector();deadline=time.monotonic()+timeout
   for name,stream in [('stdout',child.stdout),('stderr',child.stderr)]:sel.register(stream,selectors.EVENT_READ,name)
   while sel.get_map() and time.monotonic()<deadline and not overflow:
    for key,_ in sel.select(timeout=min(.1,max(0,deadline-time.monotonic()))):
     chunk=os.read(key.fileobj.fileno(),4096)
     if not chunk:sel.unregister(key.fileobj);key.fileobj.close();continue
     if len(buffers[key.data])+len(chunk)>16384:overflow=True;break
     buffers[key.data].extend(chunk)
   timed_out=bool(sel.get_map()) and not overflow
   if timed_out or overflow:kill_reap()
   else:
    try:child.wait(timeout=3)
    except subprocess.TimeoutExpired:timed_out=True;kill_reap()
  except BaseException:
   if not cleanup_attempted:kill_reap()
   raise
  finally:
   for stream in (child.stdout,child.stderr):
    try:stream.close()
    except OSError:pass
   if sel is not None:sel.close()
 return {'argv':argv,'exit':child.returncode,'stdout':bytes(buffers['stdout']).decode(errors='replace'),'stderr':bytes(buffers['stderr']).decode(errors='replace'),'timeout':timed_out,'overflow':overflow}

def _successful(result):return result['exit']==0 and not result['timeout'] and not result['overflow']
def _verify_mounted(mount):
 if not os.path.ismount(mount) or not os.statvfs(mount).f_flag&os.ST_RDONLY:raise PackageUnavailable('actual_readonly_mount_required')
 if verify_package(mount)['packageDigest']!=PACKAGE_DIGEST:raise PackageUnavailable('mounted_package_changed')

def run_exact(expected_manifest_sha):
 """One lifecycle, no retries. Requires separate exact user authorization before calling."""
 if not re.fullmatch('[0-9a-f]{64}',expected_manifest_sha):raise PackageUnavailable('reviewed_manifest_sha_required')
 manifest_path=ROOT/'final-artifact.json'
 if hashlib.sha256(manifest_path.read_bytes()).hexdigest()!=expected_manifest_sha:raise PackageUnavailable('reviewed_manifest_changed')
 manifest=json.loads(manifest_path.read_text())
 for key,name in (('resourceAttackPrepared','resource-attack'),('restrictionLauncherPrepared','resource-launcher')):
  item=manifest[key];path=Path(item['binary'])
  if path!=ROOT/name or path.is_symlink() or not stat.S_ISREG(path.lstat().st_mode) or hashlib.sha256(path.read_bytes()).hexdigest()!=item['sha256']:raise PackageUnavailable('binary_changed')
 plan=prepare_resource_fixture(ROOT) # Reverify the real pinned source package before side effects.
 claim_once(ROOT) # Atomic lifecycle claim BEFORE mkdir/image/create/attach/profile; never reuse even on failure.
 image=ROOT/'package.dmg';alias=ROOT/'package-hardlink.dmg';mount=ROOT/'mount'
 result={'scope':'resource_feasibility_only','executingIssuerIdentity':'unavailable','status':'unknown_no_retry','claimConsumed':True,'phases':[]};attach_attempted=False
 try:
  if image.exists() or alias.exists() or mount.exists():raise PackageUnavailable('fresh_owned_image_paths_required')
  mount.mkdir(mode=0o700)
  created=_run(plan['futureImageCreate'],120);result['phases'].append(created)
  if not _successful(created):raise PackageUnavailable('image_creation_unavailable')
  os.link(image,alias);result['before']=inspect_alias_pair(image,alias)
  attach_attempted=True;attached=_run(plan['futureAttach'],30);result['phases'].append(attached)
  if not _successful(attached):raise PackageUnavailable('image_attach_unavailable')
  _verify_mounted(mount)
  for name in ('resource-attack','resource-launcher'):(ROOT/name).chmod(0o700)
  attacked=_run([str(ROOT/'resource-launcher'),'--resource-restriction-once'],15);result['phases'].append(attacked)
  result['after']=inspect_alias_pair(image,alias)
  unchanged=result['before']['file']==result['after']['file']
  result['status']='resource_unit_observations_only' if _successful(attacked) and unchanged else 'resource_matrix_failed'
 except BaseException as error:
  result['failureType']=type(error).__name__ # No exception text/env/customer data.
  if image.exists() and alias.exists():
   try:result['after']=inspect_alias_pair(image,alias)
   except BaseException:result['after']='unknown'
  raise
 finally:
  for name in ('resource-attack','resource-launcher'):
   try:(ROOT/name).chmod(0o600)
   except OSError:result['modeRestore']='unknown';result['status']='unknown_no_retry'
  if attach_attempted and os.path.ismount(mount):
   try:result['detach']=_run(plan['futureDetach'],30)
   except BaseException:result['detach']='unknown';result['status']='unknown_no_retry'
  if isinstance(result.get('detach'),dict) and not _successful(result['detach']):result['status']='unknown_no_retry'
  result['mountStillAttached']=os.path.ismount(mount)
  if result['mountStillAttached']:result['status']='unknown_no_retry'
  if image.exists() and alias.exists():
   try:
    result['afterCleanup']=inspect_alias_pair(image,alias)
    if result.get('before',{}).get('file')!=result['afterCleanup']['file']:result['status']='resource_matrix_failed'
   except BaseException:result['afterCleanup']='unknown';result['status']='unknown_no_retry'
  elif 'before' in result:result['afterCleanup']='unknown';result['status']='unknown_no_retry'
  if result.get('modeRestore')=='unknown' or result.get('detach')=='unknown' or result['mountStillAttached'] or (isinstance(result.get('detach'),dict) and not _successful(result['detach'])):result['status']='unknown_no_retry'
  with (ROOT/'resource-result.json').open('x') as output:output.write(json.dumps(result,indent=2)+'\n')
 return result

if __name__=='__main__':
 if len(sys.argv)!=3 or sys.argv[1]!='--run-exact-reviewed-resource-experiment':raise SystemExit('Execution disabled; separate exact approval and manifest hash required')
 print(json.dumps(run_exact(sys.argv[2]),sort_keys=True))
