"""Fixed read-only image inspection. No runtime, signing or issuer authority."""
from pathlib import Path
import json,os,plistlib,re,selectors,signal,stat,subprocess,time
from . import system_preparation as prep,manifest
RUN_ROOT=Path('/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Qualification Lab/2026-11-05-real-container-assembly-558f12f1')
CAP=256*1024
class InspectionStopped(ValueError):
 def __init__(self,reason,possible_mounted_image=True):super().__init__(reason);self.possible_mounted_image=possible_mounted_image
def _need(value,reason):
 if not value:raise ValueError(reason)
def _device(value):
 _need(type(value)is str and value.isascii()and len(value)<=128 and re.fullmatch(r'/dev/disk[0-9]+(?:s[0-9]+)*',value)is not None,'literal_device_required');return value
def _attach_argv(image):return ['/usr/bin/hdiutil','attach','-readonly','-nobrowse','-noautoopen','-plist','-mountpoint',str(RUN_ROOT/'mount'),str(image)]
def _run(argv,seconds):
 valid_attach=argv==_attach_argv(RUN_ROOT/'image/issuer-package.dmg')and seconds==90
 valid_detach=type(argv)is list and len(argv)==3 and argv[:2]==['/usr/bin/hdiutil','detach']and seconds==60
 if valid_detach:_device(argv[2])
 _need(valid_attach or valid_detach,'fixed_image_command_required')
 _need(signal.getsignal(signal.SIGCHLD)==signal.SIG_DFL,'exclusive_image_child_reaping_required')
 p=None;selector=None;data={'stdout':bytearray(),'stderr':bytearray()};state='completed';error=None;start=time.monotonic()
 try:
  p=subprocess.Popen(argv,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env={'PATH':'/usr/bin:/bin:/usr/sbin:/sbin','LANG':'C','LC_ALL':'C'})
  selector=selectors.DefaultSelector()
  for name,pipe in (('stdout',p.stdout),('stderr',p.stderr)):os.set_blocking(pipe.fileno(),False);selector.register(pipe,selectors.EVENT_READ,name)
  while selector.get_map():
   if time.monotonic()-start>=seconds:state='timeout';break
   for key,_ in selector.select(.1):
    remaining=CAP-sum(map(len,data.values()));part=os.read(key.fileobj.fileno(),min(4096,remaining+1))
    if not part:selector.unregister(key.fileobj);continue
    data[key.data].extend(part[:remaining])
    if len(part)>remaining:state='output_bound';break
   if state!='completed':break
  if state=='completed':
   try:p.wait(timeout=max(.001,seconds-(time.monotonic()-start)))
   except subprocess.TimeoutExpired:state='timeout'
 except BaseException as exc:state='monitor_or_launch_error';error=type(exc).__name__
 finally:
  if p is not None and p.returncode is None:
   try:p.kill()
   except ProcessLookupError:pass
   except BaseException as exc:error=error or type(exc).__name__
   try:p.wait(timeout=5)
   except BaseException as exc:error=error or type(exc).__name__
  if p is not None:
   for pipe in (p.stdout,p.stderr):
    try:pipe.close()
    except BaseException as exc:error=error or type(exc).__name__
  if selector is not None:
   try:selector.close()
   except BaseException as exc:error=error or type(exc).__name__
 return {'argv':argv,'state':state,'exit':p.returncode if p is not None else None,'stdout':bytes(data['stdout']),'stderr':bytes(data['stderr']),'cleanup':'reaped_original_child'if p is not None and p.returncode is not None else'unknown','errorType':error}
def _success(record):return record.get('state')=='completed'and type(record.get('exit'))is int and record['exit']==0 and record.get('cleanup')=='reaped_original_child'and record.get('errorType')is None
def _select_device(data):
 _need(type(data)is bytes and len(data)<=CAP,'bounded_attach_plist_required');value=plistlib.loads(data)
 _need(type(value)is dict and type(value.get('system-entities'))is list and 1<=len(value['system-entities'])<=32 and all(type(x)is dict for x in value['system-entities']),'attach_entities_required')
 mounted=[x for x in value['system-entities']if type(x)is dict and 'mount-point'in x]
 _need(len(mounted)==1 and mounted[0].get('mount-point')==str(RUN_ROOT/'mount'),'single_exact_mount_required');return _device(mounted[0].get('dev-entry'))
def _mount_identity(mount):
 p=prep._path(Path(mount));s=p.lstat();_need(stat.S_ISDIR(s.st_mode),'mounted_directory_required');v=os.statvfs(p)
 return {'stDev':s.st_dev,'stIno':s.st_ino,'readOnly':bool(v.f_flag&os.ST_RDONLY)}
def _namespace_restored(mount,empty):
 try:s=Path(mount).lstat()
 except FileNotFoundError:return True
 if not stat.S_ISDIR(s.st_mode)or stat.S_ISLNK(s.st_mode)or s.st_uid!=os.getuid()or stat.S_IMODE(s.st_mode)!=0o700:return False
 if {'stDev':s.st_dev,'stIno':s.st_ino}!=empty:return False
 return not bool(os.statvfs(mount).f_flag&os.ST_RDONLY)
def _content(mount):
 from .container_assembly import binding
 result=manifest.verify_package(mount);raw=binding(Path(mount)/manifest.MANIFEST);tree=manifest.strict_json(manifest.read_bytes_bounded(Path(mount)/manifest.MANIFEST,64*1024**2))
 return {'qualification':result['qualification'],'packageDigest':result['packageDigest'],'manifestSha256':raw['sha256'],'sourceRevision':tree['provenance']['sourceRevision']}
def _write(path,value):prep._write(path,manifest.canonical(value)+b'\n')
def _save_command(root,name,record):
 from .container_assembly import binding
 _need(type(record['stdout'])is bytes and type(record['stderr'])is bytes and len(record['stdout'])+len(record['stderr'])<=CAP,'bounded_command_output_required')
 result={k:v for k,v in record.items()if k not in ('stdout','stderr')};result['format']='axiom.fixed-image-command/1'
 for stream in ('stdout','stderr'):
  path=root/(name+'-'+stream+'.log');prep._write(path,record[stream]);result[stream]=binding(path)
 path=root/(name+'-command.json');_write(path,result);return binding(path)
def inspect_image(image_binding,package):
 from .container_assembly import binding,_bound
 cp=RUN_ROOT;prep._path(cp);_need(cp.is_dir()and stat.S_IMODE(cp.stat().st_mode)==0o700,'private_inspection_run_required')
 image=cp/'image/issuer-package.dmg';_need(image_binding.get('path')==str(image),'fixed_inspection_image_required');before=_bound(image_binding)
 root=cp/'inspection';root.mkdir(mode=0o700);_need(stat.S_IMODE(root.stat().st_mode)==0o700,'private_inspection_output_required')
 mount=cp/'mount';mount.mkdir(mode=0o700);_need(stat.S_IMODE(mount.stat().st_mode)==0o700,'private_inspection_mount_required')
 empty_stat=mount.lstat();empty={'stDev':empty_stat.st_dev,'stIno':empty_stat.st_ino}
 attach=None;detach=None;owned=False;detached=False;identity=None;device=None;content=None;failure=None
 try:
  record=_run(_attach_argv(image),90);attach=_save_command(root,'attach',record);_need(_success(record),'attach_unknown_or_failed')
  device=_select_device(record['stdout']);identity=_mount_identity(mount)
  _need(all(type(identity.get(k))is int and identity[k]>0 for k in ('stDev','stIno')),'mount_identity_required')
  _need({k:identity[k]for k in ('stDev','stIno')}!=empty,'mounted_namespace_not_observed');owned=True
  _need(identity.get('readOnly')is True,'mount_not_readonly')
  content=_content(mount);_need(content.get('qualification')=='package_file_set_verified'and all(content.get(k)==package[k]for k in ('packageDigest','manifestSha256','sourceRevision')),'mounted_content_mismatch')
 except BaseException as error:failure=type(error).__name__+':'+str(error)
 finally:
  if owned:
   try:
    _need(_mount_identity(mount)==identity and _bound(image_binding)==before,'mount_or_image_ownership_changed')
    record=_run(['/usr/bin/hdiutil','detach',device],60);detach=_save_command(root,'detach',record);_need(_success(record),'detach_unknown_or_failed')
    _need(_namespace_restored(mount,empty),'detach_namespace_not_restored');detached=True
   except BaseException as error:failure=failure or type(error).__name__+':'+str(error)
 try:
  after_image=binding(image)
  if after_image!=before:failure=failure or'image_changed_after_inspection'
 except BaseException as error:after_image=None;failure=failure or type(error).__name__+':'+str(error)
 result={'format':'axiom.readonly-image-inspection/1','state':'content_verified_detached'if failure is None and detached else'failed_or_unknown','imageBefore':before,'imageAfter':after_image,'package':package,'mountPath':str(mount),'emptyMountIdentity':empty,'detachNamespaceRestored':detached,'device':device,'mountIdentity':identity,'content':content,'attachRecord':attach,'detachRecord':detach,'possibleMountedImage':not detached,'failure':failure,'executionAuthorized':False,'installationReady':False,'activationAllowed':False,'runtimeIdentity':'unavailable'}
 path=root/'result.json';_write(path,result)
 if failure is not None or not detached:raise InspectionStopped(failure or'inspection_unknown',not detached)
 return path

def verify_recorded_inspection(bound,image,package):
 from .container_assembly import _json_bound,_bound
 proof=_json_bound(bound)
 _need(proof.get('format')=='axiom.readonly-image-inspection/1'and proof.get('state')=='content_verified_detached'and proof.get('possibleMountedImage')is False and proof.get('detachNamespaceRestored')is True and proof.get('failure')is None,'completed_detached_inspection_required')
 _need(all(proof.get(k)is False for k in ('executionAuthorized','installationReady','activationAllowed'))and proof.get('runtimeIdentity')=='unavailable','unqualified_inspection_required')
 _need(proof.get('imageBefore')==image and proof.get('imageAfter')==image and proof.get('package')==package and proof.get('mountPath')==str(RUN_ROOT/'mount'),'inspection_image_package_join_required')
 device=_device(proof.get('device'));empty=proof.get('emptyMountIdentity',{});_need(set(empty)=={'stDev','stIno'}and all(type(empty[k])is int and empty[k]>0 for k in empty),'recorded_empty_namespace_required')
 identity=proof.get('mountIdentity',{});_need({k:identity.get(k)for k in ('stDev','stIno')}!=empty,'recorded_mounted_namespace_required');_need(identity.get('readOnly')is True and all(type(identity.get(k))is int and identity[k]>0 for k in ('stDev','stIno')),'recorded_readonly_identity_required')
 for key,argv in (('attachRecord',_attach_argv(Path(image['path']))),('detachRecord',['/usr/bin/hdiutil','detach',device])):
  record=_json_bound(proof[key]);_need(record.get('argv')==argv and _success(record),'recorded_image_command_required')
  raw=[]
  for stream in ('stdout','stderr'):
   b=record[stream];_need(type(b.get('size'))is int and 0<=b['size']<=CAP,'recorded_log_bound')
   data,current=prep._snapshot(Path(b['path']),CAP)
   mode=int(b['mode'],8)if isinstance(b['mode'],str)else b['mode']
   _need(current['sha256']==b['sha256']and current['size']==b['size']and current['mode']==mode,'recorded_log_changed');raw.append(data)
  _need(sum(map(len,raw))<=CAP,'recorded_log_bound')
  if key=='attachRecord':_need(_select_device(raw[0])==device,'recorded_device_join_required')
 content=proof.get('content',{});_need(content.get('qualification')=='package_file_set_verified'and all(content.get(k)==package[k]for k in ('packageDigest','manifestSha256','sourceRevision')),'recorded_content_join_required');return proof
