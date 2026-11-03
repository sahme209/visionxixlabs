"""Closed native build-input observations. No runtime, registration or authority.

Only record BEFORE a fresh build attempt. Completed stages/receipts are immutable.
"""
from pathlib import Path
import json,os,re,stat,subprocess
from .manifest import PackageUnavailable,canonical,hash_regular,read_bytes_bounded,strict_json,refuse
PACKAGE_PATH=Path('packages/verified-issuer-runtime')
NPM_FILES=('index.cjs','index.d.ts','README.md','internal/verify-package.cjs','native/origin_guard.node')
PACKAGE_FILES=('package.json',*NPM_FILES)
GENERATED_STAGE=(str(PACKAGE_PATH/'native/origin_guard.node'),str(PACKAGE_PATH/'native/origin-bootstrap'))
SOURCE_INPUTS=tuple(str(PACKAGE_PATH/'native'/name)for name in ('origin_config.h','origin_guard.c','origin_session.c','origin_session.h','origin_process_identity.c','origin_process_identity.h','protected_resource_inventory.c','protected_resource_inventory.h','origin_bootstrap.c','origin_broker.c','origin_root_binding.h','origin_root_binding.m','origin_runtime_protocol.h','origin_runtime_protocol.c'))+('scripts/governance_local_issuer/origin_control.m',)
CONTROL_TOOLS={'controller':'AxiomIssuerController','broker':'AxiomIssuerBroker'}
RECEIPT='_axiom_native_overlay.json'
SERVICE='com.visionxixlabs.axiom.issuer-origin'
PINNED_NODE=Path('/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node')

def private(path):
 path=Path(path);s=path.lstat()
 if path.resolve()!=path or not stat.S_ISDIR(s.st_mode)or s.st_uid!=os.getuid()or stat.S_IMODE(s.st_mode)&0o077:refuse('native_overlay_private_directory_required')
 return path

def snapshot(path,limit=2*1024**3):
 path=Path(path)
 if not path.is_absolute()or path.resolve()!=path:refuse('native_overlay_canonical_artifact_required')
 before,sha,_=hash_regular(path,limit)
 if before.st_uid!=os.getuid()or before.st_nlink!=1:refuse('native_overlay_owned_singlelink_required')
 return {'path':str(path),'sha256':sha,'size':before.st_size,'mode':stat.S_IMODE(before.st_mode)}

def validate_layout(layout):
 if not isinstance(layout,dict)or set(layout)!={'packageRoot','controlApp','imageBacking','spawnClaim','service'}or layout['service']!=SERVICE:refuse('native_overlay_fixed_layout_required')
 for key in ('packageRoot','controlApp','imageBacking','spawnClaim'):
  p=Path(layout[key])
  if not p.is_absolute()or str(p)!=layout[key]or any(c in layout[key]for c in ('\0','\n','\r'))or '..' in p.parts:refuse('native_overlay_absolute_layout_required')
 control=Path(layout['controlApp']);private(control.parent)
 if layout['imageBacking']!=str(control/'Contents/Resources/issuer-package.dmg')or layout['spawnClaim']!=str(control.parent/'issuer-startup-claim.json'):refuse('native_overlay_control_layout_mismatch')
 return layout

def validate_requirements(requirements):
 if not isinstance(requirements,dict)or set(requirements)!={'node','controller','broker'}or any(not isinstance(v,str)or not re.fullmatch(r'cdhash H"[a-f0-9]{40}"',v)for v in requirements.values()):refuse('native_overlay_exact_code_requirements_required')
 return requirements

def verify_requirement(path,requirement):
 result=subprocess.run(['/usr/bin/codesign','--verify','--strict','-R',requirement,str(path)],capture_output=True,timeout=15)
 if result.returncode:refuse('native_overlay_signature_requirement_mismatch')

def compiler_definitions(layout,requirements,role):
 values={'PACKAGE_ROOT':layout['packageRoot'],'IMAGE_BACKING':layout['imageBacking'],'ORIGIN_SERVICE':SERVICE,'CONTROL_APP':layout['controlApp'],'SPAWN_CLAIM':layout['spawnClaim']}
 if role=='broker':values.update(NODE_REQUIREMENT=requirements['node'],CONTROLLER_REQUIREMENT=requirements['controller'])
 if role=='guard':values['BROKER_REQUIREMENT']=requirements['broker']
 return ['-DAXIOM_ISSUER_'+key+'='+json.dumps(value)for key,value in sorted(values.items())]

def compile_recipe(stage,node,layout,requirements):
 stage=private(stage);node=Path(node);validate_layout(layout);validate_requirements(requirements)
 if node!=PINNED_NODE:refuse('native_overlay_pinned_node_required')
 source=stage/PACKAGE_PATH/'native';mac=Path(layout['controlApp'])/'Contents/MacOS'
 common=['/usr/bin/xcrun','clang','-std=c11','-Wall','-Wextra','-Werror','-O1','-fblocks','-mmacosx-version-min=13.0','-I'+str(source),'-framework','CoreFoundation']
 specs=(('controller',['scripts/governance_local_issuer/origin_control.m'],['-framework','Foundation','-framework','Security'],mac/CONTROL_TOOLS['controller']),('broker',[str(PACKAGE_PATH/'native'/x)for x in ('origin_broker.c','origin_runtime_protocol.c','origin_root_binding.m','origin_process_identity.c','protected_resource_inventory.c')],['-framework','Foundation','-framework','Security'],mac/CONTROL_TOOLS['broker']),('bootstrap',[str(PACKAGE_PATH/'native/origin_bootstrap.c')],[],stage/GENERATED_STAGE[1]),('guard',[str(PACKAGE_PATH/'native'/x)for x in ('origin_guard.c','origin_session.c','origin_process_identity.c','protected_resource_inventory.c')],['-I'+str(node.parent.parent/'include/node'),'-bundle','-undefined','dynamic_lookup','-framework','Security'],stage/GENERATED_STAGE[0]))
 return [{'role':role,'operation':'compile_only','argv':[*common,*compiler_definitions(layout,requirements,role),*[str(stage/p)for p in files],*flags,'-o',str(output)],'output':str(output),'requiredPriorSignedRole':{'broker':'controller','guard':'broker'}.get(role)}for role,files,flags,output in specs]

def headers(node):
 root=node.parent.parent/'include/node'
 if root.is_symlink()or not root.is_dir()or root.resolve()!=root:refuse('native_overlay_node_headers_required')
 result={};total=0
 for path in sorted(root.rglob('*')):
  if path.is_symlink():refuse('native_overlay_header_symlink')
  if path.is_dir():continue
  item=snapshot(path,8*1024**2);total+=item['size']
  if len(result)>=4096 or total>64*1024**2:refuse('native_overlay_headers_bound')
  result[path.relative_to(root).as_posix()]=item
 if not {'node_api.h','node_api_types.h','js_native_api.h','js_native_api_types.h'}<=set(result):refuse('native_overlay_napi_headers_missing')
 return result

def observation(stage,revision,node,layout,requirements,build_run,*,after_build=False):
 stage=private(stage);node=Path(node);build_run=private(build_run);validate_layout(layout);validate_requirements(requirements)
 if node!=PINNED_NODE or not re.fullmatch('[a-f0-9]{40}',revision):refuse('native_overlay_source_node_required')
 if not after_build and ((stage/'.next').exists()or(stage/'.next').is_symlink()):refuse('native_overlay_must_precede_build')
 for sentinel in ('attempt.json','result.json','completed-build.json'):
  if(stage/sentinel).exists():refuse('native_overlay_completed_stage_refused')
 package=strict_json(read_bytes_bounded(stage/PACKAGE_PATH/'package.json',1024*1024))
 if not isinstance(package,dict)or package.get('name')!='@axiom/verified-issuer-runtime'or package.get('files')!=list(NPM_FILES):refuse('native_overlay_runtime_allowlist_mismatch')
 sources={p:snapshot(stage/p,8*1024**2)for p in SOURCE_INPUTS}
 artifacts={p:snapshot(stage/p)for p in GENERATED_STAGE}
 if any(item['mode']!=0o755 for item in artifacts.values()):refuse('native_overlay_executable_mode_required')
 control={role:snapshot(Path(layout['controlApp'])/'Contents/MacOS'/name)for role,name in CONTROL_TOOLS.items()}
 if any(item['mode']!=0o755 for item in control.values()):refuse('native_overlay_control_executable_mode_required')
 for role,item in control.items():verify_requirement(Path(item['path']),requirements[role])
 verify_requirement(node,requirements['node'])
 return {'format':'axiom.prebuild-native-overlay/1','sourceRevision':revision,'plannedBuildRun':str(build_run),'layout':layout,'requirements':requirements,'node':snapshot(node),'nodeHeaders':headers(node),'sourceInputs':sources,'stageArtifacts':artifacts,'controlArtifacts':control,'runtimePackageFiles':list(PACKAGE_FILES),'compileRecipe':compile_recipe(stage,node,layout,requirements),'compilerAndSDKAuthenticity':'unavailable','runtimeQualification':'unavailable','executingIssuerIdentity':'unavailable','executionAuthorized':False}

def record_overlay(stage,revision,node,layout,requirements,build_run):
 stage=private(stage);build_run=private(build_run)
 if any(build_run.iterdir()):refuse('native_overlay_fresh_build_run_required')
 value=observation(stage,revision,node,layout,requirements,build_run);path=stage/RECEIPT
 encoded=canonical(value)+b'\n'
 if len(encoded)>8*1024**2:refuse('native_overlay_receipt_bound')
 try:fd=os.open(path,os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW|os.O_WRONLY,0o600)
 except FileExistsError:refuse('native_overlay_existing_receipt_refused')
 with os.fdopen(fd,'wb')as output:output.write(encoded);output.flush();os.fsync(output.fileno())
 return value

def verify_overlay(stage,*,after_build=False):
 stage=private(stage);path=stage/RECEIPT
 if not path.exists()and not path.is_symlink():return None
 info=path.lstat()
 if info.st_uid!=os.getuid()or stat.S_IMODE(info.st_mode)!=0o600:refuse('native_overlay_private_receipt_required')
 raw=read_bytes_bounded(path,8*1024**2);value=strict_json(raw)
 if not isinstance(value,dict)or value.get('format')!='axiom.prebuild-native-overlay/1'or raw!=canonical(value)+b'\n':refuse('native_overlay_receipt_invalid')
 # Verification never mutates, recreates or re-records the original inputs.
 observed=observation(stage,value.get('sourceRevision',''),Path(value.get('node',{}).get('path','')),value.get('layout'),value.get('requirements'),Path(value.get('plannedBuildRun','')),after_build=after_build)
 if observed!=value:refuse('native_overlay_current_inputs_changed')
 return value

def main():
 import argparse
 parser=argparse.ArgumentParser(description=__doc__)
 mode=parser.add_mutually_exclusive_group(required=True);mode.add_argument('--record',action='store_true');mode.add_argument('--verify',action='store_true');mode.add_argument('--print-compile-recipe',action='store_true')
 parser.add_argument('--stage',required=True);parser.add_argument('--source');parser.add_argument('--node');parser.add_argument('--layout');parser.add_argument('--requirements');parser.add_argument('--build-run');parser.add_argument('--after-build',action='store_true')
 args=parser.parse_args()
 try:
  if args.verify:
   if any((args.source,args.node,args.layout,args.requirements,args.build_run)):refuse('native_overlay_verify_coordinates_from_original_receipt')
   result=verify_overlay(args.stage,after_build=args.after_build)
  else:
   if args.after_build or not all((args.node,args.layout,args.requirements)):refuse('native_overlay_prebuild_coordinates_required')
   layout=strict_json(read_bytes_bounded(Path(args.layout),16384));requirements=strict_json(read_bytes_bounded(Path(args.requirements),16384))
   if args.record:
    if not args.source or not args.build_run:refuse('native_overlay_record_source_build_run_required')
    result=record_overlay(args.stage,args.source,args.node,layout,requirements,args.build_run)
   else:result=compile_recipe(args.stage,args.node,layout,requirements)
  print(json.dumps({'observation':result,'executionAuthorized':False,'executingIssuerIdentity':'unavailable'},sort_keys=True));return 0
 except (PackageUnavailable,OSError,ValueError,TypeError,subprocess.SubprocessError)as error:
  print(json.dumps({'status':'unavailable','reason':str(error)if isinstance(error,PackageUnavailable)else'native_overlay_preparation_unavailable','executionAuthorized':False}));return 1

if __name__=='__main__':raise SystemExit(main())
