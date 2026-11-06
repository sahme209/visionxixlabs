"""Principal-free artifact packet. Import is inert; vendor execution is deliberate.

Ordinary fixed input preparation is reversible filesystem work. The complete
Git/sandbox/npm/Prisma/emitter bundle needs one separate exact execution decision.
"""
from pathlib import Path
import hashlib,json,os,re,stat,sys,time
if __package__ in (None,''):sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from governance_local_issuer import fixture_recipe_packet as files
from governance_local_issuer import stage_a_tools
engine_tools=files.engine_tools
builder=engine_tools.builder()
NODE_PATH=files.NODE_PATH;NODE_SHA=files.NODE_SHA;SCHEMA_SHA=files.SCHEMA_SHA;ENGINE_SHA=files.ENGINE_SHA
FORMAT='axiom.principal-free-stage-a/1';PACKAGE_ROOT='/Volumes/Axiom Synthetic Issuer-c3b7bf334ce56a64575183b7a66e5109'
PROCEDURE_NAMES=('scripts/build-local-issuer-package-source.py','scripts/local_prisma_engine_inputs.py','scripts/governance_local_issuer/stage_a_packet.py','scripts/governance_local_issuer/stage_a_tools.py','scripts/governance_local_issuer/__init__.py','scripts/governance_local_issuer/fixture_recipe_packet.py','scripts/governance_local_issuer/manifest.py','scripts/emit-synthetic-fixture-producer.cjs','scripts/private-bootstrap-typescript-loader.cjs','scripts/fixture-producer-compiler-policy.cjs','scripts/fixture-producer-runtime-closure.json')
ANCHORS=('node_modules/@prisma/client/package.json','node_modules/@prisma/client/default.js','node_modules/@prisma/client/runtime/library.js','node_modules/.prisma/client/package.json','node_modules/.prisma/client/default.js','node_modules/.prisma/client/index.js','node_modules/.prisma/client/schema.prisma','node_modules/.prisma/client/libquery_engine-darwin-arm64.dylib.node')
_json=files._json
class StageAUnavailable(ValueError):pass
def refuse(code):raise StageAUnavailable(code)
def _canonical(p):return files._canonical(p)
def _private(p):return files._private(p)
def _write(p,b):return files._write(p,b)
def _binding(path,cap=256*1024*1024):
 p=_canonical(path);s=p.lstat();state=lambda x:(x.st_dev,x.st_ino,x.st_uid,x.st_mode,x.st_nlink,x.st_size,x.st_mtime_ns,x.st_ctime_ns)
 if not stat.S_ISREG(s.st_mode)or s.st_nlink!=1 or s.st_uid not in (0,os.getuid())or not 0<=s.st_size<=cap:refuse('fixed_regular_input_required')
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW|os.O_CLOEXEC);h=hashlib.sha256();n=0
 try:
  if state(os.fstat(fd))!=state(s):refuse('input_changed')
  while True:
   b=os.read(fd,65536)
   if not b:break
   n+=len(b)
   if n>cap:refuse('input_limit')
   h.update(b)
  if state(os.fstat(fd))!=state(s)or state(p.lstat())!=state(s)or n!=s.st_size:refuse('input_changed')
 finally:os.close(fd)
 return {'path':str(p),'sha256':h.hexdigest(),'size':n,'mode':stat.S_IMODE(s.st_mode),'dev':s.st_dev,'ino':s.st_ino,'mtimeNs':s.st_mtime_ns,'ctimeNs':s.st_ctime_ns}
def _load(path):return files._load(path)
def _sources(repo):
 closure=_load(repo/'scripts/fixture-producer-runtime-closure.json')
 if closure.get('format')!='axiom.fixture-producer-compiler-closure/1'or not isinstance(closure.get('sourceFiles'),dict):refuse('compiler_source_closure_required')
 names=sorted(set(PROCEDURE_NAMES)|{'package.json','package-lock.json','prisma/schema.prisma','lib/governance/qualification/fixture-seed.sql','docs/product/axiom-master-action-plan.md'}|set(closure['sourceFiles']))
 if len(names)>256:refuse('source_limit')
 out={}
 for name in names:
  if Path(name).is_absolute()or '..'in Path(name).parts:refuse('source_escape')
  out[name]=_binding(repo/name,16*1024*1024)
  if name in closure['sourceFiles']and out[name]['sha256']!=closure['sourceFiles'][name]:refuse('compiler_source_changed')
 return out
def _cache(repo,cache):
 package=_load(repo/'package.json');lock=_load(repo/'package-lock.json');plan=builder.lock_plan(package,lock);available,observation=builder.probe_cache_plan(plan,cache)
 critical=(*builder.GENERATION_PACKAGES,*builder.BUILD_PACKAGES)
 if any(any(x['location']==name or x['location'].startswith(name+'/')for name in critical)for x in observation['missing']):refuse('compiler_cache_incomplete')
 return plan,available,{'mode':'complete'if not observation['missing']else'declared_optional','observation':observation,'planSha256':hashlib.sha256(_json(plan)).hexdigest()}
def _recipes(repo,directory):
 names=('fixture-schema.sql','fixture-seed.sql','fixture-schema.binding.json','execution-observation.json','execution-attempt.json','execution-authorization.json','execution-result.json','engine-child-receipt.json','engine-stderr.raw')
 bindings={name:_binding(directory/name,8*1024*1024)for name in names};r=_load(directory/'fixture-schema.binding.json');observed=_load(directory/'execution-observation.json');attempt=_load(directory/'execution-attempt.json');authorization=_load(directory/'execution-authorization.json');result=_load(directory/'execution-result.json');child=_load(directory/'engine-child-receipt.json')
 schema,_=files._bytes(repo/'prisma/schema.prisma',8*1024*1024);models=sorted(re.findall(r'^model ([A-Za-z0-9_]+) \{',schema.decode('utf8'),re.M));needle=b'url      = env("DATABASE_URL")'
 if schema.count(needle)!=1:refuse('recipe_source_changed')
 diff=hashlib.sha256(schema.replace(needle,b'url      = "postgresql://qualification.invalid/qualification"')).hexdigest()
 expected={'format':'axiom.synthetic-fixture-schema/1','schemaSha256':SCHEMA_SHA,'engineSha256':ENGINE_SHA,'seedSha256':bindings['fixture-seed.sql']['sha256'],'sqlSha256':bindings['fixture-schema.sql']['sha256'],'diffInputSha256':diff,'completeSchema':True,'qualification':False,'models':models}
 if r!=expected or r.get('completeSchema')is not True or r.get('qualification')is not False or hashlib.sha256(schema).hexdigest()!=SCHEMA_SHA or _binding(repo/'lib/governance/qualification/fixture-seed.sql')['sha256']!=r['seedSha256']:refuse('accepted_recipe_required')
 if observed.get('status')!='exported'or observed.get('procedureInvocations')!=1 or observed.get('databaseConnectionOrApplyPerformed')is not False or observed.get('toolExit')!=0 or observed.get('cliExit')!=0 or observed.get('supervisorError')is not None or observed.get('sqlSha256')!=r['sqlSha256']or observed.get('sqlBytes')!=bindings['fixture-schema.sql']['size']or observed.get('models')!=len(models):refuse('accepted_recipe_observation_required')
 if attempt.get('format')!='axiom.fixed-recipe-attempt/1'or attempt.get('status')!='reserved_before_launch'or attempt.get('executionAuthorized')is not False or authorization.get('packetSha256')!=attempt.get('packet',{}).get('sha256')or authorization.get('procedureInvocations')!=1 or authorization.get('automaticRetryAuthorized')is not False or authorization.get('result')!='exported'or authorization.get('toolExit')!=0:refuse('consumed_recipe_provenance_required')
 if result.get('format')!='axiom.fixed-recipe-result/1'or result.get('status')!='exported'or result.get('exit')!=0 or result.get('supervisorError')is not None or result.get('executionAuthorized')is not False:refuse('accepted_recipe_result_required')
 for key,name in (('stdout.raw','fixture-schema.sql'),('recipe/fixture-schema.sql','fixture-schema.sql'),('recipe/fixture-seed.sql','fixture-seed.sql'),('recipe/fixture-schema.binding.json','fixture-schema.binding.json')):
  out=result.get('outputs',{}).get(key,{})
  if out.get('sha256')!=bindings[name]['sha256']or out.get('size')!=bindings[name]['size']:refuse('accepted_recipe_output_changed')
 argv=child.get('argv',[])
 if child.get('format')!='axiom.fixed-recipe-child/1'or child.get('status')!='exited_zero'or child.get('exit')!=0 or child.get('executionAuthorized')is not False or len(argv)!=8 or argv[0]!=NODE_PATH or argv[2:6]!=['migrate','diff','--from-empty','--to-schema-datamodel']or argv[7]!='--script'or child.get('preparedInputSha256')!=diff or child.get('environment',{}).get('CHECKPOINT_DISABLE')!='1':refuse('accepted_recipe_child_required')
 for field,name in (('stdout','fixture-schema.sql'),('stderr','engine-stderr.raw')):
  capture=child.get(field,{})
  if capture!={'sha256':bindings[name]['sha256'],'reportedSize':bindings[name]['size'],'retainedSize':bindings[name]['size']}:refuse('accepted_recipe_capture_changed')
 return bindings
def _environment(packet):
 work=Path(packet['work']);return {'PATH':str(Path(packet['node']['path']).parent)+':/usr/bin:/bin:/usr/sbin:/sbin','HOME':str(work/'home'),'XDG_CACHE_HOME':str(work/'home'),'TMPDIR':str(work/'tmp'),'AXIOM_PRIVATE_GIT_SCRATCH':str(work/'tmp'),'LANG':'C','TZ':'UTC','NODE_ENV':'production','CHECKPOINT_DISABLE':'1','PRISMA_HIDE_UPDATE_MESSAGE':'1','PRISMA_GENERATE_SKIP_AUTOINSTALL':'true','NEXT_TELEMETRY_DISABLED':'1','PYTHONDONTWRITEBYTECODE':'1'}
_driver_environment=_environment
def _log(path):return os.fdopen(os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600),'wb')
def _profile(p,log):
 return engine_tools._generation_profile(Path(p['work']),Path(p['work'])/'tmp',[Path(log)],[Path(p['repo']),Path(p['cache']),Path(p['boundInputs']['path']),Path(p['node']['path']),Path(p['npmCli']['path']),Path(p['recipeDirectory'])],read_protected=())
def prepare_stage_a_packet(repo,revision,cache,node,npm_cli,bound_inputs,recipe_dir,destination):
 repo=_canonical(repo);cache=_canonical(cache);node=_canonical(node);npm_cli=_canonical(npm_cli);bound_inputs=_private(bound_inputs);recipe_dir=_canonical(recipe_dir);destination=_canonical(destination)
 if not re.fullmatch('[a-f0-9]{40}',str(revision))or str(node)!=NODE_PATH:refuse('fixed_source_tool_required')
 if destination.exists()or destination.is_symlink():refuse('fresh_packet_required')
 for x in (repo,cache,node,npm_cli,bound_inputs,recipe_dir):
  if x==destination or x in destination.parents or destination in x.parents:refuse('packet_input_overlap')
 node_binding=_binding(node);npm_binding=_binding(npm_cli)
 if node_binding['sha256']!=NODE_SHA or node_binding['mode']!=0o755:refuse('original_node_required')
 sources=_sources(repo)
 if sources['prisma/schema.prisma']['sha256']!=SCHEMA_SHA:refuse('fixed_schema_required')
 _,available,selection=_cache(repo,cache);engines=engine_tools.verify_bound_engines(bound_inputs)
 if engines['inputs']['schema']['sha256']!=ENGINE_SHA or engines['requestedEngineCommit']!=engine_tools.REQUESTED_COMMIT:refuse('fixed_engine_inputs_required')
 recipes=_recipes(repo,recipe_dir);python=_binding(Path(sys.executable).resolve());destination.mkdir(mode=0o700);work=destination/'work';work.mkdir(mode=0o700)
 for name in ('offline','generation','emission','tmp','home'):(work/name).mkdir(mode=0o700)
 for name in ('tmp','home'):(work/'emission'/name).mkdir(mode=0o700)
 copied=builder.snapshot_cache(available,cache,work/'offline/npm-cache')
 p={'format':FORMAT,'sourceRevision':revision,'repo':str(repo),'cache':str(cache),'work':str(work),'node':node_binding,'npmCli':npm_binding,'python':python,'program':sources['scripts/governance_local_issuer/stage_a_packet.py'],'sourceBindings':sources,'cacheSelection':selection,'cacheCopy':str(copied),'boundInputs':{'path':str(bound_inputs),'receipt':_binding(bound_inputs/'receipt.json'),'observation':engines},'recipeDirectory':str(recipe_dir),'recipeBindings':recipes,'executionAuthorized':False,'runtimeQualification':'unavailable','installationReady':False,'activeBudgetSeconds':360,'outerCeilingSeconds':390}
 path=destination/'packet.json';_write(path,_json(p));verify_stage_a_packet(path);return path
def verify_stage_a_packet(path):
 path=_canonical(path);_private(path.parent);p=_load(path)
 keys={'format','sourceRevision','repo','cache','work','node','npmCli','python','program','sourceBindings','cacheSelection','cacheCopy','boundInputs','recipeDirectory','recipeBindings','executionAuthorized','runtimeQualification','installationReady','activeBudgetSeconds','outerCeilingSeconds'}
 if not isinstance(p,dict)or set(p)!=keys or p['format']!=FORMAT or p['executionAuthorized']is not False or p['installationReady']is not False or p['runtimeQualification']!='unavailable'or p['activeBudgetSeconds']!=360 or p['outerCeilingSeconds']!=390 or not re.fullmatch('[a-f0-9]{40}',str(p['sourceRevision'])):refuse('exact_packet_required')
 work=_private(p['work']);repo=_canonical(p['repo']);cache=_canonical(p['cache'])
 if work!=path.parent/'work'or str(Path(p['cacheCopy']))!=str(work/'offline/npm-cache')or p['node']['path']!=NODE_PATH:refuse('fixed_coordinates_required')
 for name in ('offline','generation','emission','tmp','home','emission/tmp','emission/home'):_private(work/name)
 for name in ('node','npmCli','python'):
  if _binding(p[name]['path'])!=p[name]:refuse('tool_changed')
 if p['node']['sha256']!=NODE_SHA or p['node']['mode']!=0o755 or p['program']!=p['sourceBindings'].get('scripts/governance_local_issuer/stage_a_packet.py'):refuse('fixed_program_required')
 if _sources(repo)!=p['sourceBindings']or _cache(repo,cache)[2]!=p['cacheSelection']or _recipes(repo,Path(p['recipeDirectory']))!=p['recipeBindings']:refuse('packet_inputs_changed')
 bound=_private(p['boundInputs']['path'])
 if _binding(bound/'receipt.json')!=p['boundInputs']['receipt']or engine_tools.verify_bound_engines(bound)!=p['boundInputs']['observation']or p['boundInputs']['observation']['inputs']['schema']['sha256']!=ENGINE_SHA:refuse('engine_inputs_changed')
 _,available,_=_cache(repo,cache)
 for item in available['tarballs']:
  blob,expected=builder.cache_path(Path(p['cacheCopy'])/'_cacache',item['integrity']);builder.stream_blob(blob,expected)
 return p
def _stage_sources(p):
 stage=Path(p['work'])/'offline/stage'
 for name,want in p['sourceBindings'].items():
  got=_binding(stage/name,16*1024*1024)
  if (got['sha256'],got['size'])!=(want['sha256'],want['size']):refuse('archived_source_changed')
 return stage

def _offline_diagnostic(phase,error):
 if phase not in ('packet','context','source','archive','extraction','archived_sources','install','receipt'):return None
 reason='offline_operation_unavailable'
 if type(error)is StageAUnavailable and len(error.args)==1 and type(error.args[0])is str and error.args[0]in ('fixed_child_context_required','archive_package_changed','offline_install_refused'):reason=error.args[0]
 return {'phase':phase,'reason':reason}
def run_offline_child(path):
 phase='packet'
 try:
  p=verify_stage_a_packet(path);phase='context';work=Path(p['work']);stage=work/'offline/stage';contained=stage_a_tools._create_stage_a_tools(p);tools=contained.builder
  if os.environ.get('AXIOM_PRIVATE_GIT_SCRATCH')!=str(work/'tmp')or stage.exists():refuse('fixed_child_context_required')
  phase='source'
  package,lock,source=tools.source_inputs(Path(p['repo']),p['sourceRevision'])
  if source['packageSha256']!=p['sourceBindings']['package.json']['sha256']or source['lockSha256']!=p['sourceBindings']['package-lock.json']['sha256']:refuse('archive_package_changed')
  phase='archive'
  archive=tools.git_bytes(Path(p['repo']),['archive','--format=tar',p['sourceRevision']]);phase='extraction';provenance=builder.extract_archive(archive,stage);phase='archived_sources';_stage_sources(p)
  phase='install'
  plan=builder.lock_plan(package,lock);dependencies=tools.install_offline(stage,plan,Path(p['cacheCopy']),Path(p['node']['path']),Path(p['npmCli']['path']),Path(p['cache']),Path(p['repo']))
  if dependencies.get('status')!='offline_dependencies_installed'or dependencies.get('exit')!=0 or dependencies.get('lifecycleScriptsExecuted')is not False or dependencies.get('network')!='kernel_denied':refuse('offline_install_refused')
  phase='receipt'
  r={'format':'axiom.stage-a-offline/1','status':'installed','sourceRevision':p['sourceRevision'],'source':source,'archive':provenance,'dependencies':dependencies,'cacheSelection':p['cacheSelection'],'executionAuthorized':False};_write(work/'offline/result.json',_json(r));return r
 except Exception as error:
  error.offlineDiagnostic=_offline_diagnostic(phase,error)
  raise

def _generation_files(p,preparation,contained=None):
 stage=_stage_sources(p);tool=Path(p['node']['path']);lock=_load(stage/'package-lock.json')
 expected={'sourceRevision':p['sourceRevision'],'packageSha256':p['sourceBindings']['package.json']['sha256'],'lockSha256':p['sourceBindings']['package-lock.json']['sha256'],'schemaSha256':SCHEMA_SHA}
 if any(preparation.get(k)!=v for k,v in expected.items())or preparation.get('node')!=str(tool)or preparation.get('engines')!=p['boundInputs']['observation']or preparation.get('sources')!=(contained.engine.verify_generation_sources(stage,Path(p['cache']))if contained else engine_tools.verify_generation_sources(stage,Path(p['cache'])))or preparation.get('nativeDependencies')!=engine_tools.verify_native_dependencies(Path(p['boundInputs']['path'])):refuse('generation_provenance_changed')
 evidence=engine_tools.verify_generation_observation(stage,Path(p['work'])/'generation',preparation,tool,p['sourceRevision']);compiler=builder.observe_build_sources(stage,lock,Path(p['cache']));anchors={n:_binding(stage/n,128*1024*1024)for n in ANCHORS}
 return {'preparation':preparation,'generationEvidence':evidence,'compilerSources':compiler,'clientBindings':anchors}
def _generation(p,contained):
 stage=_stage_sources(p);preparation=contained.engine.prepare_generation(stage,Path(p['boundInputs']['path']),Path(p['repo']),p['sourceRevision'],Path(p['cache']),Path(p['node']['path']))
 return _generation_files(p,preparation,contained)
def _recorded_generation(p):
 attempt=_load(Path(p['work'])/'generation/attempt.json');return _generation_files(p,attempt.get('preparation',{}))
def _phase_receipts(p,child):
 work=Path(p['work']);offline=_load(work/'offline/result.json');emission=_load(work/'emission/result.json')
 if child.get('sourceRevision')!=p['sourceRevision']or child.get('offline')!=_binding(work/'offline/result.json')or child.get('emission')!=_binding(work/'emission/result.json'):refuse('phase_receipt_changed')
 if offline.get('format')!='axiom.stage-a-offline/1'or offline.get('status')!='installed'or offline.get('sourceRevision')!=p['sourceRevision']or offline.get('cacheSelection')!=p['cacheSelection']or offline.get('executionAuthorized')is not False:refuse('phase_receipt_changed')
 if emission.get('format')!='axiom.stage-a-emission-result/1'or emission.get('status')!='compiled'or emission.get('sourceRevision')!=p['sourceRevision']or emission.get('generation')!=child.get('generation')or emission.get('producer')!=child.get('producer')or emission.get('executionAuthorized')is not False:refuse('phase_receipt_changed')
def _producer(p):
 path=Path(p['work'])/'offline/stage/.next/server/__axiom_private_fixture__/fixture-producer.cjs';b,binding=files._bytes(path,32*1024*1024)
 prefix=("'use strict';\n{const observation=require("+json.dumps(PACKAGE_ROOT+'/node_modules/@axiom/verified-issuer-runtime/internal/verify-package.cjs')+").verifyPackageFiles("+json.dumps(PACKAGE_ROOT)+");if(!observation||observation.qualification!==\"package_file_set_verified\")throw Error(\"fixture_package_unavailable\");}\n").encode()
 if binding['mode']!=0o600 or not b.startswith(prefix)or json.dumps(PACKAGE_ROOT+'/node_modules/@prisma/client').encode()not in b:refuse('producer_output_refused')
 if _binding(path,32*1024*1024)!=binding:refuse('producer_output_refused')
 return binding
def run_stage_a_driver(path):
 p=verify_stage_a_packet(path);contained=stage_a_tools._create_stage_a_tools(p);work=Path(p['work']);phase='offline';started=time.monotonic();result={'format':'axiom.stage-a-driver-result/1','sourceRevision':p['sourceRevision'],'status':'refused','executionAuthorized':False,'runtimeQualification':'unavailable','descendantQuiescence':'unavailable'}
 if os.environ.get('AXIOM_PRIVATE_GIT_SCRATCH')!=str(work/'tmp')or(work/'driver-result.json').exists()or(work/'offline/stage').exists():refuse('unused_driver_context_required')
 def remaining(cap):
  left=p['activeBudgetSeconds']-(time.monotonic()-started)-20
  if left<=0:refuse('active_budget_expired')
  return min(cap,left)
 try:
  cmd=[p['python']['path'],p['program']['path'],'--offline-child',str(path)]
  with _log(work/'offline/outer.log')as log:code,error=engine_tools._run_generation_child(cmd,work,_environment(p),log,remaining(120),file_size_limit=512*1024*1024,creation_mask=0o077)
  if error:result['status']='unknown';refuse('offline_cleanup_unknown')
  if code!=0:refuse('offline_child_failed')
  offline=_load(work/'offline/result.json')
  if offline.get('format')!='axiom.stage-a-offline/1'or offline.get('status')!='installed'or offline.get('sourceRevision')!=p['sourceRevision']or offline.get('executionAuthorized')is not False:refuse('offline_receipt_refused')
  if verify_stage_a_packet(path)!=p:refuse('packet_inputs_changed')
  stage=_stage_sources(p);phase='generation';contained.engine.execute_generation(stage,Path(p['boundInputs']['path']),Path(p['repo']),p['sourceRevision'],Path(p['cache']),Path(p['node']['path']),work/'generation',timeout=remaining(120));before=_generation(p,contained)
  if (stage/'.next').exists():refuse('fresh_emission_required')
  phase='emission';_write(work/'emission/attempt.json',_json({'format':'axiom.stage-a-emission-attempt/1','sourceRevision':p['sourceRevision'],'generation':before,'executionAuthorized':False}))
  environment=_environment(p);environment.update(HOME=str(work/'emission/home'),XDG_CACHE_HOME=str(work/'emission/home'),TMPDIR=str(work/'emission/tmp'))
  cmd=[p['node']['path'],str(stage/'scripts/emit-synthetic-fixture-producer.cjs')]
  with _log(work/'emission/producer.log')as log:code,error=engine_tools._run_generation_child(cmd,stage,environment,log,remaining(60),file_size_limit=128*1024*1024,creation_mask=0o077)
  if error:result['status']='unknown';refuse('emission_cleanup_unknown')
  if code!=0:refuse('emission_child_failed')
  phase='reconciliation';after=_generation(p,contained)
  if before!=after or verify_stage_a_packet(path)!=p:refuse('artifact_inputs_changed')
  producer=_producer(p);emission={'format':'axiom.stage-a-emission-result/1','status':'compiled','sourceRevision':p['sourceRevision'],'producer':producer,'generation':after,'executionAuthorized':False};_write(work/'emission/result.json',_json(emission));result.update(status='artifact_observed',sourceRevision=p['sourceRevision'],offline=_binding(work/'offline/result.json'),generation=after,emission=_binding(work/'emission/result.json'),producer=producer)
 except Exception as error:
  diagnostic=getattr(error,'launchDiagnostic',None)
  if type(diagnostic)is dict and set(diagnostic)=={'phase','class','errno'}and diagnostic['phase']in ('null_input','spawn','git_spawn')and diagnostic['class']in ('OSError','SubprocessError')and diagnostic['errno']in ('EPERM','EACCES','ENOENT','EMFILE','ENFILE','ENOMEM','EAGAIN','EIO','ENOEXEC','UNKNOWN'):result['launchDiagnostic']=diagnostic
  if isinstance(error,engine_tools.Unavailable)and len(error.args)==1 and error.args[0]in ('generation_original_child_cleanup_unknown','generation_parent_wall_timeout','generation_output_limit','generation_parent_stdin_cleanup_unknown'):result['status']='unknown'
  allowed={'active_budget_expired','offline_cleanup_unknown','offline_child_failed','offline_receipt_refused','packet_inputs_changed','fresh_emission_required','emission_cleanup_unknown','emission_child_failed','artifact_inputs_changed','producer_output_refused','archived_source_changed'}
  result.update(phase=phase,reason=error.args[0]if isinstance(error,StageAUnavailable)and len(error.args)==1 and error.args[0]in allowed else'artifact_phase_unavailable')
 _write(work/'driver-result.json',_json(result));return result

def execute_stage_a_packet(path):
 path=_canonical(path);p=verify_stage_a_packet(path);root=path.parent;work=Path(p['work'])
 if any((root/n).exists()or(root/n).is_symlink()for n in ('attempt.json','result.json','outer.log'))or(work/'driver-result.json').exists()or(work/'offline/stage').exists():refuse('unused_packet_required')
 packet_binding=_binding(path);_write(root/'attempt.json',_json({'format':'axiom.stage-a-attempt/1','packet':packet_binding,'status':'reserved_before_launch','executionAuthorized':False}));fd=os.open(root/'result.json',os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600);result={'format':'axiom.stage-a-result/1','status':'refused','executionAuthorized':False,'runtimeQualification':'unavailable','descendantQuiescence':'unavailable'}
 try:
  cmd=['/usr/bin/sandbox-exec','-p',_profile(p,root/'outer.log'),p['python']['path'],p['program']['path'],'--driver-child',str(path)]
  with _log(root/'outer.log')as log:code,error=engine_tools._run_generation_child(cmd,work,_environment(p),log,390,file_size_limit=512*1024*1024,creation_mask=0o077)
  if error:result.update(status='unknown',reason='original_child_cleanup_or_deadline_unknown')
  elif code==0:
   child=_load(work/'driver-result.json')
   if child.get('format')!='axiom.stage-a-driver-result/1'or child.get('status')!='artifact_observed'or child.get('executionAuthorized')is not False or verify_stage_a_packet(path)!=p or _binding(path)!=packet_binding:refuse('final_child_or_input_refused')
   _phase_receipts(p,child);evidence=_recorded_generation(p)
   if evidence!=child.get('generation')or _producer(p)!=child.get('producer'):refuse('final_artifact_changed')
   result.update(status='artifact_observed',sourceRevision=p['sourceRevision'],producer=child['producer'],driverResult=_binding(work/'driver-result.json'),generation=evidence)
  else:
   result['reason']='driver_refused'
   if (work/'driver-result.json').is_file():
    child=_load(work/'driver-result.json')
    if child.get('format')=='axiom.stage-a-driver-result/1'and child.get('sourceRevision')==p['sourceRevision']and child.get('status')=='unknown'and child.get('executionAuthorized')is False:result.update(status='unknown',reason='driver_cleanup_or_deadline_unknown',driverResult=_binding(work/'driver-result.json'))
 except Exception:result['reason']='artifact_observation_unavailable'
 finally:
  with os.fdopen(fd,'wb')as output:output.write(_json(result));output.flush();os.fsync(output.fileno())
 return result
if __name__=='__main__':
 try:
  if len(sys.argv)!=3 or sys.argv[1]not in ('--offline-child','--driver-child'):refuse('fixed_child_invocation_required')
  value=run_offline_child(sys.argv[2])if sys.argv[1]=='--offline-child'else run_stage_a_driver(sys.argv[2]);sys.exit(0 if value['status']in ('installed','artifact_observed')else 73)
 except Exception as error:
  diagnostic=getattr(error,'launchDiagnostic',None)
  if type(diagnostic)is dict and set(diagnostic)=={'phase','class','errno'}and diagnostic['phase']in ('null_input','spawn','git_spawn')and diagnostic['class']in ('OSError','SubprocessError')and diagnostic['errno']in ('EPERM','EACCES','ENOENT','EMFILE','ENFILE','ENOMEM','EAGAIN','EIO','ENOEXEC','UNKNOWN'):sys.stderr.write(json.dumps({'error':'stage_a_artifact_unavailable','launchDiagnostic':diagnostic},sort_keys=True)+'\n')
  else:
   offline=getattr(error,'offlineDiagnostic',None)
   if type(offline)is dict and set(offline)=={'phase','reason'} and _offline_diagnostic(offline.get('phase'),StageAUnavailable(offline.get('reason')))==offline:sys.stderr.write(json.dumps({'error':'stage_a_artifact_unavailable','offlineDiagnostic':offline},sort_keys=True)+'\n')
   else:sys.stderr.write('stage_a_artifact_unavailable\n')
  sys.exit(74)
