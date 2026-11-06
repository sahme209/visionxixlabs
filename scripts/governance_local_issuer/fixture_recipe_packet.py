"""Fixed recipe packet preparation and existing-supervisor adapter.

Importing performs no work. Fixed input preparation performs ordinary local
filesystem work; Node/CLI/engine/sandbox execution is separately authorized.
Tests use owned synthetic inputs and a mocked child supervisor.
"""
from pathlib import Path
import hashlib,importlib.util,json,os,re,stat,time
from .manifest import verify_package,MANIFEST,strict_json
_spec=importlib.util.spec_from_file_location('axiom_recipe_engine_tools',Path(__file__).parents[1]/'local_prisma_engine_inputs.py')
engine_tools=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(engine_tools)
NODE_PATH='/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node'
NODE_SHA='e4b5a3af0e05c75de2eae013904145f40fe7fc2a6e6f17510128bf45cca4e79b'
ENGINE_SHA='57b090d47b947dc9284379d9480d11ffe14fe63155e3da515b359f3aa7fa408a'
SCHEMA_SHA='50e1fbbf50d5d28ba08e862a72789de3c5a9fdad5d7589751a86e0135c5eb031'
FORMAT='axiom.fixed-recipe-export/1';CAP=8*1024*1024
SOURCE=('prisma/schema.prisma','lib/governance/qualification/fixture-seed.sql','scripts/prepare-synthetic-fixture-recipe.cjs','scripts/synthetic-fixture-recipe-driver.cjs')
DEPENDENCIES=('prisma/build/index.js','@prisma/engines/dist/index.js')
class RecipePacketUnavailable(ValueError):pass
def refuse(reason):raise RecipePacketUnavailable(reason)
def _canonical(path):
 p=Path(path)
 if not p.is_absolute()or str(p)!=str(path)or p.resolve()!=p or any(x.is_symlink()for x in (p,*p.parents)):refuse('canonical_input_required')
 return p
def _private(path):
 p=_canonical(path);s=p.stat()
 if not stat.S_ISDIR(s.st_mode)or s.st_uid!=os.getuid()or stat.S_IMODE(s.st_mode)!=0o700:refuse('private_owned_directory_required')
 return p
def _observe(path,max_bytes=256*1024*1024,executable=False,capture=False):
 p=_canonical(path);before=p.lstat();fields=lambda s:(s.st_dev,s.st_ino,s.st_uid,s.st_mode,s.st_nlink,s.st_size,s.st_mtime_ns,s.st_ctime_ns)
 if not stat.S_ISREG(before.st_mode)or before.st_nlink!=1 or before.st_uid!=os.getuid()or not 0<=before.st_size<=max_bytes or executable and stat.S_IMODE(before.st_mode)!=0o755:refuse('stable_regular_input_required')
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW|os.O_CLOEXEC);digest=hashlib.sha256();total=0;chunks=[]
 try:
  if fields(os.fstat(fd))!=fields(before):refuse('input_changed')
  while True:
   data=os.read(fd,65536)
   if not data:break
   total+=len(data)
   if total>max_bytes:refuse('input_size_limit')
   digest.update(data)
   if capture:chunks.append(data)
  if fields(os.fstat(fd))!=fields(before):refuse('input_changed')
 finally:os.close(fd)
 if total!=before.st_size or fields(p.lstat())!=fields(before):refuse('input_changed')
 binding={'path':str(p),'sha256':digest.hexdigest(),'size':total,'mode':stat.S_IMODE(before.st_mode),'dev':before.st_dev,'ino':before.st_ino,'mtimeNs':before.st_mtime_ns,'ctimeNs':before.st_ctime_ns}
 return (b''.join(chunks),binding)if capture else binding
def _file(path,max_bytes=256*1024*1024,executable=False):return _observe(path,max_bytes,executable)
def _bytes(path,max_bytes=16*1024*1024):return _observe(path,max_bytes,capture=True)
def _write(path,data):
 fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
 with os.fdopen(fd,'wb')as f:f.write(data);f.flush();os.fsync(f.fileno())
def _json(value):return(json.dumps(value,sort_keys=True,separators=(',',':'))+'\n').encode()
def _load(path):
 raw,_=_bytes(path,4*1024*1024);return strict_json(raw)
def _accepted(root,expected):
 root=_canonical(root);observed=verify_package(root)
 if observed['packageDigest']!=expected or observed['executionAuthorized']is not False:refuse('accepted_package_changed')
 manifest_bytes,manifest_binding=_bytes(root/MANIFEST,64*1024*1024);manifest= strict_json(manifest_bytes);materialization=_file(root.parent/'materialization.json',8*1024*1024)
 if manifest['provenance']['materializationReceiptSha256']!=materialization['sha256']:refuse('accepted_materialization_changed')
 return {'root':str(root),'digest':expected,'manifest':manifest_binding,'materialization':materialization}
def _view(view,accepted,expected):
 view=_private(view);expected_names={'prisma','prisma/schema.prisma','lib','lib/governance','lib/governance/qualification','lib/governance/qualification/fixture-seed.sql','node_modules'}
 if {x.relative_to(view).as_posix()for x in view.rglob('*')}!=expected_names:refuse('fixed_input_view_changed')
 link=view/'node_modules'
 if not link.is_symlink()or os.readlink(link)!=str(Path(accepted)/'node_modules')or link.resolve()!=Path(accepted)/'node_modules':refuse('fixed_dependency_link_changed')
 for item in expected:
  if _file(item['path'])!=item:refuse('input_view_changed')
def _profile(destination,work,source,accepted,node,engine):
 # read_protected deliberately empty: it DENIES reads, not writes. Reads remain
 # default-allowed; this is trusted-tool network/write bounding, not secrecy.
 return engine_tools._generation_profile(work,work/'tmp',[destination/'outer-child.log'],[source,accepted,node,engine],read_protected=())
def prepare_recipe_packet(source_repo,accepted_root,node,engine,destination,source_revision,expected_package_digest):
 source=_canonical(source_repo);accepted=_canonical(accepted_root);node=_canonical(node);engine=_canonical(engine);destination=_canonical(destination)
 if not re.fullmatch('[a-f0-9]{40}',str(source_revision))or not re.fullmatch('[a-f0-9]{64}',str(expected_package_digest)):refuse('fixed_source_and_package_required')
 if str(node)!=NODE_PATH or engine!=source/'node_modules/@prisma/engines/schema-engine-darwin-arm64':refuse('fixed_tool_input_required')
 if destination.exists()or destination.is_symlink():refuse('fresh_destination_required')
 for protected in (source,accepted,node,engine):
  if protected==destination or protected in destination.parents or destination in protected.parents:refuse('packet_boundary_overlap')
 package=_accepted(accepted,expected_package_digest);node_binding=_file(node,executable=True);engine_binding=_file(engine,executable=True)
 if node_binding['sha256']!=NODE_SHA or engine_binding['sha256']!=ENGINE_SHA:refuse('fixed_tool_hash_required')
 sources=[_file(source/name,16*1024*1024)for name in SOURCE]
 if sources[0]['sha256']!=SCHEMA_SHA:refuse('fixed_schema_required')
 schema,schema_binding=_bytes(sources[0]['path']);
 if schema_binding!=sources[0]:refuse('source_changed')
 needle=b'url      = env("DATABASE_URL")'
 if schema.count(needle)!=1:refuse('fixed_schema_datasource_required')
 prepared=schema.replace(needle,b'url      = "postgresql://qualification.invalid/qualification"')
 dependencies=[_file(accepted/'node_modules'/name,16*1024*1024)for name in DEPENDENCIES]
 destination.mkdir(mode=0o700);view=destination/'input-view';view.mkdir(mode=0o700);work=destination/'work';work.mkdir(mode=0o700)
 for name in ('tmp','home'):(work/name).mkdir(mode=0o700)
 views=[]
 for relative,item in zip(SOURCE[:2],sources[:2]):
  output=view/relative;parent=view
  for part in Path(relative).parts[:-1]:parent=parent/part;parent.mkdir(mode=0o700,exist_ok=True)
  data,current=_bytes(item['path'])
  if current!=item:refuse('source_changed')
  _write(output,data);views.append(_file(output))
 (view/'node_modules').symlink_to(accepted/'node_modules',target_is_directory=True)
 packet={'format':FORMAT,'sourceRevision':source_revision,'sourceRepo':str(source),'repo':str(view),'work':str(work),'node':node_binding,'engine':engine_binding,'recipeHelper':sources[2],'driver':sources[3],'inputs':[node_binding,engine_binding,*sources,*views,*dependencies],'sourceBindings':sources,'viewBindings':views,'acceptedPackage':package,'diffInputSha256':hashlib.sha256(prepared).hexdigest(),'executionAuthorized':False,'sandboxProfile':_profile(destination,work,source,accepted,node,engine)}
 path=destination/'packet.json';_write(path,_json(packet));verify_recipe_packet(path);return path
def verify_recipe_packet(packet_path):
 path=_canonical(packet_path);destination=_private(path.parent);packet=_load(path)
 keys={'format','sourceRevision','sourceRepo','repo','work','node','engine','recipeHelper','driver','inputs','sourceBindings','viewBindings','acceptedPackage','diffInputSha256','executionAuthorized','sandboxProfile'}
 if not isinstance(packet,dict)or set(packet)!=keys or packet['format']!=FORMAT or packet['executionAuthorized']is not False or not re.fullmatch('[a-f0-9]{40}',str(packet['sourceRevision'])):refuse('exact_packet_required')
 source=_canonical(packet['sourceRepo']);accepted=_canonical(packet['acceptedPackage']['root']);node=_canonical(packet['node']['path']);engine=_canonical(packet['engine']['path']);work=_private(packet['work'])
 if Path(packet['repo'])!=destination/'input-view'or work!=destination/'work'or str(node)!=NODE_PATH or engine!=source/'node_modules/@prisma/engines/schema-engine-darwin-arm64':refuse('fixed_packet_coordinates_required')
 _private(work/'tmp');_private(work/'home')
 if _accepted(accepted,packet['acceptedPackage']['digest'])!=packet['acceptedPackage']:refuse('accepted_package_changed')
 expected_sources=[str(source/name)for name in SOURCE]
 if [x['path']for x in packet['sourceBindings']]!=expected_sources or packet['recipeHelper']!=packet['sourceBindings'][2]or packet['driver']!=packet['sourceBindings'][3]:refuse('fixed_source_bindings_required')
 _view(packet['repo'],accepted,packet['viewBindings'])
 if len(packet['viewBindings'])!=2 or any(view['sha256']!=source_item['sha256']or view['size']!=source_item['size']for view,source_item in zip(packet['viewBindings'],packet['sourceBindings'][:2])):refuse('view_source_mismatch')
 expected_paths=[str(node),str(engine),*expected_sources,str(destination/'input-view/prisma/schema.prisma'),str(destination/'input-view/lib/governance/qualification/fixture-seed.sql'),*[str(accepted/'node_modules'/name)for name in DEPENDENCIES]]
 if [x['path']for x in packet['inputs']]!=expected_paths or packet['inputs'][2:6]!=packet['sourceBindings']or packet['inputs'][6:8]!=packet['viewBindings']:refuse('fixed_input_bindings_required')
 for binding in packet['inputs']:
  if _file(binding['path'],executable=binding['path']in (str(node),str(engine)))!=binding:refuse('input_changed')
 if packet['node']!=packet['inputs'][0]or packet['engine']!=packet['inputs'][1]or packet['node']['sha256']!=NODE_SHA or packet['engine']['sha256']!=ENGINE_SHA or packet['sourceBindings'][0]['sha256']!=SCHEMA_SHA:refuse('fixed_hash_required')
 schema,current=_bytes(expected_sources[0])
 if current!=packet['sourceBindings'][0]:refuse('source_changed')
 needle=b'url      = env("DATABASE_URL")'
 if schema.count(needle)!=1 or hashlib.sha256(schema.replace(needle,b'url      = "postgresql://qualification.invalid/qualification"')).hexdigest()!=packet['diffInputSha256']:refuse('diff_input_changed')
 if packet['sandboxProfile']!=_profile(destination,work,source,accepted,node,engine):refuse('fixed_profile_required')
 return packet

def _verify_outputs(packet):
 work=Path(packet['work']);files=['prepared-schema.prisma','stdout.raw','stderr.raw','child.json','driver-result.json','recipe/fixture-schema.sql','recipe/fixture-seed.sql','recipe/fixture-schema.binding.json'];bindings={name:_file(work/name,CAP)for name in files}
 if any(x['mode']!=0o600 for x in bindings.values()):refuse('private_output_required')
 child=_load(work/'child.json');result=_load(work/'driver-result.json');binding=_load(work/'recipe/fixture-schema.binding.json')
 if child.get('format')!='axiom.fixed-recipe-child/1'or child.get('status')!='exited_zero'or child.get('exit')!=0 or result.get('format')!='axiom.fixed-recipe-driver-result/1'or result.get('status')!='exported'or result.get('binding')!=binding or result.get('executionAuthorized')is not False:refuse('successful_recipe_export_required')
 if binding.get('schemaSha256')!=SCHEMA_SHA or binding.get('engineSha256')!=ENGINE_SHA or binding.get('diffInputSha256')!=packet['diffInputSha256']or binding.get('qualification')is not False or binding.get('completeSchema')is not True:refuse('recipe_binding_changed')
 if binding.get('sqlSha256')!=bindings['stdout.raw']['sha256']or bindings['stdout.raw']['sha256']!=bindings['recipe/fixture-schema.sql']['sha256']or binding.get('seedSha256')!=packet['sourceBindings'][1]['sha256']or bindings['recipe/fixture-seed.sql']['sha256']!=binding['seedSha256']or bindings['prepared-schema.prisma']['sha256']!=packet['diffInputSha256']:refuse('recipe_output_join_changed')
 expected_env={'NODE_ENV':'production','PRISMA_SCHEMA_ENGINE_BINARY':packet['engine']['path'],'PRISMA_HIDE_UPDATE_MESSAGE':'true','CHECKPOINT_DISABLE':'1','PRISMA_GENERATE_SKIP_AUTOINSTALL':'true','HOME':str(work/'home'),'TMPDIR':str(work/'tmp'),'XDG_CACHE_HOME':str(work/'home'),'PATH':str(Path(packet['node']['path']).parent)+':/usr/bin:/bin:/usr/sbin:/sbin','LANG':'C','TZ':'UTC'}
 argv=child.get('argv',[]);cwd=child.get('cwd','')
 if not isinstance(argv,list)or len(argv)!=8 or argv[:6]!=[packet['node']['path'],str(Path(packet['repo'])/'node_modules/prisma/build/index.js'),'migrate','diff','--from-empty','--to-schema-datamodel']or argv[7]!='--script'or not isinstance(argv[6],str)or Path(argv[6]).name!='schema.prisma'or str(Path(argv[6]).parent)!=cwd or not cwd.startswith(str(work/'tmp')+'/axiom-schema-only-')or child.get('environment')!=expected_env or child.get('preparedInputSha256')!=packet['diffInputSha256']:refuse('fixed_child_command_required')
 for name in ('stdout','stderr'):
  captured=child.get(name,{})
  if captured!={'sha256':bindings[name+'.raw']['sha256'],'reportedSize':bindings[name+'.raw']['size'],'retainedSize':bindings[name+'.raw']['size']}:refuse('child_capture_changed')
 schema,observed=_bytes(Path(packet['repo'])/'prisma/schema.prisma')
 if observed!=packet['viewBindings'][0]:refuse('view_source_mismatch')
 models=sorted(re.findall(r'^model ([A-Za-z0-9_]+) \{',schema.decode('utf8'),re.M))
 expected_binding={'format':'axiom.synthetic-fixture-schema/1','schemaSha256':SCHEMA_SHA,'engineSha256':ENGINE_SHA,'diffInputSha256':packet['diffInputSha256'],'sqlSha256':bindings['stdout.raw']['sha256'],'seedSha256':packet['sourceBindings'][1]['sha256'],'models':models,'completeSchema':True,'qualification':False}
 if binding!=expected_binding:refuse('exact_recipe_binding_required')
 if binding.get('models')!=models or (work/'driver-failure.json').exists():refuse('complete_recipe_required')
 if child.get('environment',{}).get('PRISMA_SCHEMA_ENGINE_BINARY')!=packet['engine']['path']or child.get('environment',{}).get('CHECKPOINT_DISABLE')!='1':refuse('fixed_child_environment_required')
 return bindings

def execute_recipe_packet(packet_path):
 packet=verify_recipe_packet(packet_path);path=_canonical(packet_path);destination=path.parent;work=Path(packet['work'])
 fixed=['outer-child.log','attempt.json','result.json']
 if any((destination/name).exists()or(destination/name).is_symlink()for name in fixed)or any((work/name).exists()for name in ('recipe','prepared-schema.prisma','stdout.raw','stderr.raw','child.json','driver-result.json','driver-failure.json')):refuse('unused_packet_required')
 packet_binding=_file(path);attempt={'format':'axiom.fixed-recipe-attempt/1','status':'reserved_before_launch','packet':packet_binding,'executionAuthorized':False,'processBounds':'original_owned_group_only','descendantQuiescence':'unavailable'}
 _write(destination/'attempt.json',_json(attempt));result_fd=os.open(destination/'result.json',os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600);log_fd=os.open(destination/'outer-child.log',os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
 result={'format':'axiom.fixed-recipe-result/1','status':'refused','executionAuthorized':False,'runtimeQualification':'unavailable','descendantQuiescence':'unavailable'}
 command=['/usr/bin/sandbox-exec','-p',packet['sandboxProfile'],packet['node']['path'],packet['driver']['path'],str(path)]
 environment={'PATH':str(Path(packet['node']['path']).parent)+':/usr/bin:/bin:/usr/sbin:/sbin','HOME':str(work/'home'),'XDG_CACHE_HOME':str(work/'home'),'TMPDIR':str(work/'tmp'),'LANG':'C','TZ':'UTC','NODE_ENV':'production','CHECKPOINT_DISABLE':'1','PRISMA_HIDE_UPDATE_MESSAGE':'true','PRISMA_GENERATE_SKIP_AUTOINSTALL':'true'}
 stage='prelaunch'
 try:
  if verify_recipe_packet(path)!=packet or _file(path)!=packet_binding:refuse('prelaunch_input_changed')
  stage='supervisor'
  with os.fdopen(log_fd,'wb')as log:
   log_fd=-1
   code,error=engine_tools._run_generation_child(command,work,environment,log,60,file_size_limit=64*1024*1024,creation_mask=0o077)
  supervisor_errors={'generation_parent_wall_timeout','generation_output_limit','generation_original_child_cleanup_unknown'}
  result.update(exit=code if type(code)is int and -255<=code<=255 else None,supervisorError=error if error in supervisor_errors else 'supervisor_unavailable'if error else None,command=command)
  stage='postlaunch'
  if verify_recipe_packet(path)!=packet or _file(path)!=packet_binding:refuse('postlaunch_input_changed')
  if code==0 and not error:
   stage='export_join';result.update(status='exported',outputs=_verify_outputs(packet))
  else:result.update(stage='supervisor',reason='child_nonzero'if not error else 'supervisor_unavailable')
 except Exception as error:
  allowed={'canonical_input_required','private_owned_directory_required','stable_regular_input_required','input_changed','input_size_limit','accepted_package_changed','accepted_materialization_changed','fixed_input_view_changed','fixed_dependency_link_changed','input_view_changed','exact_packet_required','fixed_packet_coordinates_required','fixed_source_bindings_required','view_source_mismatch','fixed_input_bindings_required','fixed_hash_required','source_changed','diff_input_changed','fixed_profile_required','private_output_required','successful_recipe_export_required','recipe_binding_changed','recipe_output_join_changed','fixed_child_command_required','child_capture_changed','exact_recipe_binding_required','complete_recipe_required','fixed_child_environment_required','prelaunch_input_changed','postlaunch_input_changed'}
  reason=error.args[0]if isinstance(error,RecipePacketUnavailable)and len(error.args)==1 and error.args[0]in allowed else 'packet_or_export_unavailable'
  result.update(stage=stage,reason=reason)
 finally:
  if log_fd>=0:os.close(log_fd)
  with os.fdopen(result_fd,'wb')as output:output.write(_json(result));output.flush();os.fsync(output.fileno())
 return result
