"""Fixed System-profile source/app assembly only; never executes a recipe.

Staging is not installation. No signature command, target process, account,
service, root ownership change or installed authorization is performed here.
"""
from pathlib import Path
import hashlib,json,os,plistlib,re,stat
GENERATION='c3b7bf334ce56a64575183b7a66e5109'
ROOT='/Library/Application Support/Vision XIX Labs/Axiom Synthetic Custodian/generations/'+GENERATION
APP=ROOT+'/Axiom Synthetic Custodian.app'
OWNER_PATH=APP+'/Contents/Helpers/AxiomSyntheticLaunchOwner'
OWNER_SERVICE='com.visionxixlabs.axiom.synthetic.launch-owner.'+GENERATION
BROKER_SERVICE='com.visionxixlabs.axiom.synthetic.bootstrap.'+GENERATION
PACKAGE_ROOT='/Volumes/Axiom Synthetic Issuer-'+GENERATION
NATIVE='packages/verified-issuer-runtime/native/'
ROLE_SOURCES={
 'owner':('origin_launch_owner.c','owner_launch.c','owner_resume.c','owner_privilege_drop.c','owner_journal.c','owner_journal_native.c','owner_protocol.c','system_peer_binding.c','origin_process_identity.c','protected_resource_inventory.c'),
 'broker':('origin_broker.c','origin_owner_binding.c','system_peer_binding.c','owner_protocol.c','origin_runtime_protocol.c','origin_root_binding.m','origin_process_identity.c','protected_resource_inventory.c','origin_private_resource_supplier.m','origin_private_bootstrap.c','origin_private_bootstrap_writer.c','synthetic_resource_contract.c','cssm_policy_builder.c','cssm_policy_copy.c','cssm_policy_inspect.c'),
 'controller':('scripts/governance_local_issuer/origin_control.m',),
 'maintenance':('synthetic_resource_maintenance_main.c','synthetic_resource_provisioner.m','synthetic_resource_contract.c','cssm_policy_builder.c','cssm_policy_copy.c','cssm_policy_inspect.c','origin_process_identity.c','protected_resource_inventory.c'),
 'bootstrap':('origin_bootstrap.c',),
 'guard':('origin_guard.c','origin_session.c','origin_process_identity.c','protected_resource_inventory.c'),
}
ROLE_SOURCE_PATHS=tuple(sorted({x if role=='controller' else NATIVE+x for role,files in ROLE_SOURCES.items() for x in files}))
PACKAGE_SOURCE_PATHS=tuple('packages/verified-issuer-runtime/'+x for x in ('package.json','index.cjs','index.d.ts','README.md','internal/verify-package.cjs'))
RECEIPT='system-preparation.json'
MAX_FILE=8*1024*1024
MAX_TOTAL=128*1024*1024
class SystemPreparationUnavailable(ValueError):pass
def _refuse(reason):raise SystemPreparationUnavailable(reason)
def _path(value):
 p=Path(value)
 if not p.is_absolute() or str(p)!=str(value) or '..' in p.parts or p.resolve()!=p:_refuse('canonical_absolute_path_required')
 for parent in (p,*p.parents):
  if parent.is_symlink():_refuse('symlink_path_refused')
 return p
def _snapshot(path,limit=MAX_FILE):
 p=_path(path);before=p.lstat()
 if not stat.S_ISREG(before.st_mode) or before.st_nlink!=1 or before.st_uid!=os.getuid() or before.st_size<0 or before.st_size>limit:_refuse('owned_regular_input_required')
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW|os.O_CLOEXEC)
 try:
  opened=os.fstat(fd)
  if (opened.st_dev,opened.st_ino)!=(before.st_dev,before.st_ino):_refuse('input_replaced')
  chunks=[];total=0
  while True:
   data=os.read(fd,65536)
   if not data:break
   total+=len(data)
   if total>limit:_refuse('input_bound')
   chunks.append(data)
  after=os.fstat(fd)
 finally:os.close(fd)
 current=p.lstat()
 fields=lambda s:(s.st_dev,s.st_ino,s.st_uid,s.st_mode,s.st_nlink,s.st_size,s.st_mtime_ns,s.st_ctime_ns)
 if fields(before)!=fields(after) or fields(before)!=fields(current):_refuse('input_changed')
 data=b''.join(chunks)
 return data,{'sha256':hashlib.sha256(data).hexdigest(),'size':len(data),'mode':stat.S_IMODE(before.st_mode),'dev':before.st_dev,'ino':before.st_ino,'mtimeNs':before.st_mtime_ns,'ctimeNs':before.st_ctime_ns}
def _config(c,phase):
 if phase not in ('complete','native-leaves','controller-first'):_refuse('unsupported_preparation_phase')
 keys={'format','generation','principal','lifetimeNs','nativeProfile','systemProfile','team','node','requirements'}
 if not isinstance(c,dict) or set(c)!=keys or c['format']!='axiom.system-preparation-config/1' or c['generation']!=GENERATION:_refuse('exact_system_config_required')
 p=c['principal']
 if not isinstance(p,dict) or set(p)!={'account','uid','gid'} or p['account']!='_axiomissuer_synthetic' or any(type(p[k]) is not int or not 1<=p[k]<=2147483647 for k in ('uid','gid')):_refuse('reviewed_nonroot_principal_required')
 if type(c['lifetimeNs']) is not int or not 0<c['lifetimeNs']<2**63:_refuse('exact_lifetime_required')
 if c['nativeProfile']!='hardened-runtime-no-exceptions/1' or c['systemProfile']!='trusted-owner-root-journal/1' or c['team']!='FG5N98FE6W':_refuse('unsupported_system_profile')
 n=c['node'];q=c['requirements']
 if not isinstance(n,dict) or set(n)!={'path','sha256','headers'} or not re.fullmatch('[a-f0-9]{64}',str(n['sha256'])):_refuse('bound_node_required')
 required={'node','controller','brokerForGuard'} if phase=='complete' else ({'node','controller'} if phase=='native-leaves' else set())
 if phase=='controller-first'and q!={}:_refuse('controller_first_has_no_code_requirements')
 if not isinstance(q,dict) or not required<=set(q) or not set(q)<={'node','controller','brokerForGuard'} or any(not isinstance(v,str) or not re.fullmatch('cdhash H"[a-f0-9]{40}"',v) for v in q.values()):_refuse('exact_leaf_requirements_required')
 return c
def _inputs(repo,config):
 source={};pending=list(ROLE_SOURCE_PATHS)+list(PACKAGE_SOURCE_PATHS)
 while pending:
  name=pending.pop()
  if name in source:continue
  if not name or Path(name).is_absolute() or '..' in Path(name).parts:_refuse('relative_source_required')
  data,snap=_snapshot(repo/name);source[name]=(data,snap)
  if len(source)>256 or sum(x[1]['size'] for x in source.values())>MAX_TOTAL:_refuse('source_closure_bound')
  if Path(name).suffix in ('.h','.c','.m'):
   for included in re.findall(rb'^\s*#(?:include|import)\s+"([^"\r\n]+)"',data,re.M):
    header=included.decode('ascii')
    if header in ('node_api.h','node_api_types.h','js_native_api.h','js_native_api_types.h'):continue
    h=Path(name).parent/header
    if Path(header).is_absolute() or '..' in h.parts:_refuse('source_include_escape')
    if not (repo/h).exists() and '/' not in header:h=Path(NATIVE)/header
    pending.append(h.as_posix())
 node,node_snapshot=_snapshot(Path(config['node']['path']),2*1024**3)
 if node_snapshot['sha256']!=config['node']['sha256']:_refuse('node_input_changed')
 headers={};hroot=_path(config['node']['headers'])
 if not hroot.is_dir() or hroot.stat().st_uid!=os.getuid():_refuse('owned_node_headers_required')
 for p in sorted(hroot.rglob('*')):
  if p.is_symlink():_refuse('header_symlink_refused')
  if p.is_dir():continue
  data,snap=_snapshot(p);headers[p.relative_to(hroot).as_posix()]=(data,snap)
  if len(headers)>4096 or sum(x[1]['size'] for x in headers.values())>64*1024**2:_refuse('header_bound')
 if not {'node_api.h','node_api_types.h','js_native_api.h','js_native_api_types.h'}<=set(headers):_refuse('napi_headers_missing')
 return source,(node,node_snapshot),headers
def _mkdir(path):
 if path.exists():
  if path.is_symlink() or not path.is_dir() or path.stat().st_uid!=os.getuid() or stat.S_IMODE(path.stat().st_mode)!=0o700:_refuse('private_directory_required')
  return
 if not path.parent.exists():_mkdir(path.parent)
 path.mkdir(mode=0o700)
def _write(path,data):
 _mkdir(path.parent)
 fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW|os.O_CLOEXEC,0o600)
 with os.fdopen(fd,'wb')as f:f.write(data)
 if stat.S_IMODE(path.stat().st_mode)!=0o600:_refuse('private_output_required')
def _header(c,phase):
 values={'AX_OWNER_PROFILE':2,'AX_OWNER_FIXED_UID':c['principal']['uid'],'AX_OWNER_FIXED_GID':c['principal']['gid'],'AX_OWNER_MAX_LIFETIME_NS':str(c['lifetimeNs'])+'ULL','AXIOM_ISSUER_PACKAGE_ROOT':PACKAGE_ROOT,'AXIOM_ISSUER_IMAGE_BACKING':APP+'/Contents/Resources/issuer-package.dmg','AXIOM_ISSUER_CONTROL_APP':APP,'AXIOM_ISSUER_ORIGIN_SERVICE':BROKER_SERVICE}
 if phase!='controller-first':
  values['AXIOM_ISSUER_NODE_REQUIREMENT']=c['requirements']['node']
  values['AXIOM_ISSUER_CONTROLLER_REQUIREMENT']=c['requirements']['controller']
 if phase=='complete':values['AXIOM_ISSUER_BROKER_REQUIREMENT']=c['requirements']['brokerForGuard']
 lines=['/* Preparation data only. Existing owner/supplier operational gates stay OFF. */']
 for key,v in values.items():
  literal=str(v)if isinstance(v,int)or key.endswith('_NS')else json.dumps(v)
  lines.append('#define '+key+' '+literal)
 return ('\n'.join(lines)+'\n').encode()
def _recipes(stage,phase):
 native=stage/'source'/NATIVE;app=stage/'assembly/Axiom Synthetic Custodian.app'
 outputs={'owner':app/'Contents/Helpers/AxiomSyntheticLaunchOwner','broker':app/'Contents/MacOS/AxiomIssuerBroker','controller':app/'Contents/MacOS/AxiomIssuerController','maintenance':app/'Contents/Helpers/AxiomSyntheticProvisioner','bootstrap':stage/'payload/__axiom_runtime__/origin-bootstrap','guard':stage/'payload/node_modules/@axiom/verified-issuer-runtime/native/origin_guard.node'}
 common=['/usr/bin/xcrun','clang','-std=c11','-Wall','-Wextra','-Werror','-Wno-deprecated-declarations','-fblocks','-mmacosx-version-min=13.0','-I'+str(native),'-include',str(stage/'config/system-preparation.h')]
 result=[]
 for role,files in ROLE_SOURCES.items():
  if phase=='native-leaves'and role=='guard':continue
  if phase=='controller-first'and role!='controller':continue
  src=[stage/'source'/(x if role=='controller'else NATIVE+x)for x in files]
  flags=[]if role=='bootstrap'else['-framework','CoreFoundation','-framework','Security']
  if role in ('broker','controller','maintenance'):flags+=['-framework','Foundation']
  if role=='guard':flags+=['-I'+str(stage/'headers'),'-bundle','-undefined','dynamic_lookup']
  result.append({'role':role,'operation':'compile_only','argv':[*common,*map(str,src),*flags,'-o',str(outputs[role])],'output':str(outputs[role]),'requiredOutputMode':0o600,'execute':False})
 return result
def prepare_system(repo,stage,config,*,phase='complete'):
 c=json.loads(json.dumps(_config(config,phase),sort_keys=True));repo=_path(repo);stage=_path(stage)
 parent=stage.parent
 if not parent.is_dir() or parent.stat().st_uid!=os.getuid() or stat.S_IMODE(parent.stat().st_mode)!=0o700:_refuse('fresh_private_stage_parent_required')
 if stage.exists() or stage.is_symlink():_refuse('fresh_stage_required')
 source,node,headers=_inputs(repo,c)
 # All inputs freeze before the first output. No failed/old stage is repaired.
 stage.mkdir(mode=0o700)
 for name,(data,_)in source.items():_write(stage/'source'/name,data)
 for name in PACKAGE_SOURCE_PATHS:
  relative=Path(name).relative_to('packages/verified-issuer-runtime')
  _write(stage/'payload/node_modules/@axiom/verified-issuer-runtime'/relative,source[name][0])
 _write(stage/'payload/__axiom_runtime__/node',node[0])
 for name,(data,_)in headers.items():_write(stage/'headers'/name,data)
 _write(stage/'config/system-preparation.h',_header(c,phase))
 app=stage/'assembly/Axiom Synthetic Custodian.app'
 for name in ('Contents/MacOS','Contents/Helpers','Contents/Resources'):_mkdir(app/name)
 _write(app/'Contents/Info.plist',plistlib.dumps({'CFBundleIdentifier':'com.visionxixlabs.axiom.synthetic.custodian','CFBundleName':'Axiom Synthetic Custodian','CFBundlePackageType':'APPL','CFBundleVersion':'0','CFBundleExecutable':'AxiomIssuerBroker'},sort_keys=True))
 daemon={'Label':OWNER_SERVICE,'ProgramArguments':[OWNER_PATH],'MachServices':{OWNER_SERVICE:True},'KeepAlive':False,'RunAtLoad':False,'UserName':'root','GroupName':'wheel'}
 _write(stage/'assembly/LaunchDaemons'/f'{OWNER_SERVICE}.plist',plistlib.dumps(daemon,sort_keys=True))
 recipes=_recipes(stage,phase)
 for recipe in recipes:_mkdir(Path(recipe['output']).parent)
 _write(stage/'compile-plan.json',(json.dumps(recipes,indent=2)+'\n').encode())
 # Detect source mutations that happened during real copying, not only preflight.
 for name,(_,before)in source.items():
  if _snapshot(repo/name)[1]!=before:_refuse('source_changed_during_preparation')
 if _snapshot(Path(c['node']['path']),2*1024**3)[1]!=node[1]:_refuse('node_changed_during_preparation')
 for name,(_,before)in headers.items():
  if _snapshot(Path(c['node']['headers'])/name)[1]!=before:_refuse('header_changed_during_preparation')
 manifest={p.relative_to(stage).as_posix():{'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'size':p.stat().st_size}for p in sorted(stage.rglob('*'))if p.is_file()}
 result={'format':'axiom.system-preparation/1','preparationPhase':phase,'generation':GENERATION,'config':c,'sourceInputs':{k:v[1]for k,v in source.items()},'nodeInput':node[1],'headerInputs':{k:v[1]for k,v in headers.items()},'intendedInstallation':{'root':ROOT,'app':APP,'owner':OWNER_PATH,'packageRoot':PACKAGE_ROOT,'image':APP+'/Contents/Resources/issuer-package.dmg','ownerService':OWNER_SERVICE,'requiredRootOwnership':True},'staging':str(stage),'compileRecipes':recipes,'files':manifest,'unresolved':['actual_installation_and_runtime_qualification_missing','broker_service_topology_unqualified','compiled_consumer_materialization_missing','signing_and_resource_custody_unqualified'],'executionAuthorized':False,'installationReady':False,'activationAllowed':False,'configurationAuthority':'unverified declarations only'}
 if phase=='native-leaves':result['unresolved'].append('guard_requires_actual_signed_broker')
 if phase=='controller-first':result['unresolved'].extend(['native_leaves_require_actual_node_and_controller','guard_requires_actual_signed_broker'])
 _write(stage/RECEIPT,(json.dumps(result,sort_keys=True,indent=2)+'\n').encode())
 return result
def verify_preparation(stage):
 stage=_path(stage)
 if not stage.is_dir()or stage.stat().st_uid!=os.getuid()or stat.S_IMODE(stage.stat().st_mode)!=0o700:_refuse('private_stage_required')
 raw,receipt_snapshot=_snapshot(stage/RECEIPT)
 if receipt_snapshot['mode']!=0o600:_refuse('private_receipt_required')
 r=json.loads(raw)
 if r.get('format')!='axiom.system-preparation/1'or r.get('staging')!=str(stage)or r.get('executionAuthorized')is not False or r.get('installationReady')is not False or r.get('activationAllowed')is not False:_refuse('closed_preparation_required')
 actual={p.relative_to(stage).as_posix()for p in stage.rglob('*')if p.is_file()}
 if actual!=set(r['files'])|{RECEIPT}:_refuse('stage_file_set_changed')
 for name,want in r['files'].items():
  data,snap=_snapshot(stage/name,2*1024**3)
  if snap['mode']!=0o600 or snap['sha256']!=want['sha256'] or len(data)!=want['size']:_refuse('stage_bytes_changed')
 for p in stage.rglob('*'):
  if p.is_symlink()or(p.is_dir()and stat.S_IMODE(p.stat().st_mode)!=0o700):_refuse('stage_layout_changed')
 return True
