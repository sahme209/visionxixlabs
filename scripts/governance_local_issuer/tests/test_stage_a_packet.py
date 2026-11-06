"""Finite artifact orchestration; vendor/Git/process boundaries fully mocked."""
from pathlib import Path
import hashlib,io,json,os,struct,sys,tarfile,tempfile,unittest,stat,types
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).parents[2]))
from governance_local_issuer import stage_a_packet as p
class StageAPacketTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory(prefix='axiom-stage-a-unit-',dir='/private/tmp');self.addCleanup(self.temp.cleanup);self.root=Path(self.temp.name);self.root.chmod(0o700);self.repo=self.root/'repo';self.repo.mkdir(mode=0o700);self.cache=self.root/'cache';self.cache.mkdir(mode=0o700);self.bound_parent=self.root/'engines';self.bound_parent.mkdir(mode=0o700)
  def native(kind):
   name=b'/usr/lib/libSystem.B.dylib\0';size=(24+len(name)+7)//8*8;command=struct.pack('<IIIIII',0xc,size,24,0,0,0)+name+b'\0'*(size-24-len(name));return struct.pack('<IiiIIIII',0xfeedfacf,0x100000c,0,6 if kind=='query' else 2,1,len(command),0,0)+command+b'FAKE ENGINE NEVER EXECUTE'
  source=self.root/'engine-source';source.mkdir();(source/'libquery-engine').write_bytes(native('query'));(source/'schema-engine').write_bytes(native('schema'));self.engine_observation=p.engine_tools.bind_local_engines(source,self.bound_parent);self.bound=self.bound_parent/'engine-inputs'
  self.node=self.root/'node';self.node.write_bytes(b'FAKE ORIGINAL NODE');self.node.chmod(0o755);self.npm=self.root/'npm-cli.js';self.npm.write_bytes(b'FAKE NPM NEVER RUN')
  self.schema=b'datasource db {\n url      = env("DATABASE_URL")\n}\nmodel Example {\n id String @id\n}\n';self.seed=b'-- fake seed\n';self.package={'name':'fake-app','dependencies':{}};self.lock={'lockfileVersion':3,'packages':{'':{'dependencies':{}}}}
  actual=Path(__file__).resolve().parents[3]
  for name in p.PROCEDURE_NAMES:self.put(self.repo/name,(actual/name).read_bytes())
  for name,data in {'package.json':json.dumps(self.package).encode(),'package-lock.json':json.dumps(self.lock).encode(),'prisma/schema.prisma':self.schema,'lib/governance/qualification/fixture-seed.sql':self.seed,'docs/product/axiom-master-action-plan.md':b'SYNTHETIC MASTER','lib/governance/qualification/privateFixtureAuthentication.ts':b'SYNTHETIC AUTH SOURCE'}.items():self.put(self.repo/name,data)
  closure={'format':'axiom.fixture-producer-compiler-closure/1','sourceFiles':{'lib/governance/qualification/privateFixtureAuthentication.ts':hashlib.sha256(b'SYNTHETIC AUTH SOURCE').hexdigest()},'packageFiles':{},'versions':{}};self.put(self.repo/'scripts/fixture-producer-runtime-closure.json',json.dumps(closure).encode())
  self.recipe=self.root/'recipe';self.recipe.mkdir(mode=0o700);sql=b'CREATE TABLE "Example" (id text);';self.put(self.recipe/'fixture-schema.sql',sql);self.put(self.recipe/'fixture-seed.sql',self.seed)
  diff=hashlib.sha256(self.schema.replace(b'url      = env("DATABASE_URL")',b'url      = "postgresql://qualification.invalid/qualification"')).hexdigest();binding={'format':'axiom.synthetic-fixture-schema/1','schemaSha256':hashlib.sha256(self.schema).hexdigest(),'engineSha256':self.engine_observation['inputs']['schema']['sha256'],'seedSha256':hashlib.sha256(self.seed).hexdigest(),'sqlSha256':hashlib.sha256(sql).hexdigest(),'diffInputSha256':diff,'completeSchema':True,'qualification':False,'models':['Example']};self.put(self.recipe/'fixture-schema.binding.json',p._json(binding));self.put(self.recipe/'engine-stderr.raw',b'')
  self.put(self.recipe/'execution-observation.json',p._json({'status':'exported','procedureInvocations':1,'databaseConnectionOrApplyPerformed':False,'toolExit':0,'cliExit':0,'supervisorError':None,'sqlSha256':binding['sqlSha256'],'sqlBytes':len(sql),'models':1}));self.put(self.recipe/'execution-attempt.json',p._json({'format':'axiom.fixed-recipe-attempt/1','status':'reserved_before_launch','executionAuthorized':False,'packet':{'sha256':'d'*64}}));self.put(self.recipe/'execution-authorization.json',p._json({'packetSha256':'d'*64,'procedureInvocations':1,'automaticRetryAuthorized':False,'result':'exported','toolExit':0}))
  out={name:{'sha256':hashlib.sha256(data).hexdigest(),'size':len(data)}for name,data in [('stdout.raw',sql),('recipe/fixture-schema.sql',sql),('recipe/fixture-seed.sql',self.seed),('recipe/fixture-schema.binding.json',(self.recipe/'fixture-schema.binding.json').read_bytes())]};self.put(self.recipe/'execution-result.json',p._json({'format':'axiom.fixed-recipe-result/1','status':'exported','exit':0,'supervisorError':None,'executionAuthorized':False,'outputs':out}))
  self.put(self.recipe/'engine-child-receipt.json',p._json({'format':'axiom.fixed-recipe-child/1','status':'exited_zero','exit':0,'executionAuthorized':False,'argv':[str(self.node),'/accepted/prisma/index.js','migrate','diff','--from-empty','--to-schema-datamodel','/private/scratch/schema.prisma','--script'],'preparedInputSha256':diff,'environment':{'CHECKPOINT_DISABLE':'1'},'stdout':{'sha256':binding['sqlSha256'],'reportedSize':len(sql),'retainedSize':len(sql)},'stderr':{'sha256':hashlib.sha256(b'').hexdigest(),'reportedSize':0,'retainedSize':0}}))
  self.dest=self.root/'new-packet'
  for name,value in {'NODE_PATH':str(self.node),'NODE_SHA':hashlib.sha256(self.node.read_bytes()).hexdigest(),'SCHEMA_SHA':hashlib.sha256(self.schema).hexdigest(),'ENGINE_SHA':self.engine_observation['inputs']['schema']['sha256']}.items():patcher=patch.object(p,name,value);patcher.start();self.addCleanup(patcher.stop)
 def put(self,path,data):path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data);path.chmod(0o600);return path
 def prepare(self):return p.prepare_stage_a_packet(self.repo,'a'*40,self.cache,self.node,self.npm,self.bound,self.recipe,self.dest)
 def test_preparation_is_file_only_and_does_not_create_stage_or_system_profile(self):
  with patch.object(p.builder,'git_bytes',side_effect=AssertionError('NO GIT')),patch.object(p.engine_tools,'_run_generation_child',side_effect=AssertionError('NO CHILD')):path=self.prepare();packet=p.verify_stage_a_packet(path)
  self.assertEqual(packet['cacheSelection']['mode'],'complete');self.assertFalse((self.dest/'work/offline/stage').exists());self.assertFalse(packet['executionAuthorized']);self.assertEqual(packet['sourceRevision'],'a'*40);self.assertNotIn('principal',packet)
 def test_input_change_refuses_without_launch_and_reused_destination_refuses(self):
  path=self.prepare();self.node.write_bytes(b'CHANGED');self.assertRaises(Exception,p.verify_stage_a_packet,path);self.assertRaises(Exception,self.prepare)
 def test_outer_attempt_is_consumed_even_for_unknown_supervisor(self):
  path=self.prepare()
  def run(command,stage,env,log,timeout,**kwargs):
   self.assertTrue((self.dest/'attempt.json').exists());self.assertTrue((self.dest/'result.json').exists());self.assertEqual(timeout,390);self.assertEqual(kwargs['file_size_limit'],512*1024*1024);self.assertEqual(env['AXIOM_PRIVATE_GIT_SCRATCH'],str(self.dest/'work/tmp'));return None,'generation_original_child_cleanup_unknown'
  with patch.object(p.engine_tools,'_run_generation_child',side_effect=run)as child:result=p.execute_stage_a_packet(path)
  self.assertEqual(result['status'],'unknown');self.assertEqual(child.call_count,1);self.assertRaises(Exception,p.execute_stage_a_packet,path)
 def test_failed_first_phase_never_generates_or_emits(self):
  path=self.prepare();packet=p.verify_stage_a_packet(path)
  with patch.dict(os.environ,p._driver_environment(packet),clear=True),patch.object(p.engine_tools,'_run_generation_child',return_value=(1,None))as child,patch.object(p.engine_tools,'execute_generation',side_effect=AssertionError('NO GENERATION')):result=p.run_stage_a_driver(path)
  self.assertEqual(result['status'],'refused');self.assertEqual(result['phase'],'offline');self.assertEqual(child.call_count,1)
 def archive(self):
  output=io.BytesIO()
  with tarfile.open(fileobj=output,mode='w')as archive:
   for path in sorted(self.repo.rglob('*')):
    if not path.is_file():continue
    data=path.read_bytes();item=tarfile.TarInfo(path.relative_to(self.repo).as_posix());item.size=len(data);item.mode=0o644;archive.addfile(item,io.BytesIO(data))
  return output.getvalue()
 def joined(self,path,*,emit_fail=False,generation_unknown=False):
  packet=p.verify_stage_a_packet(path);stage=self.dest/'work/offline/stage';events=[];generation_source={'status':'SYNTHETIC SOURCE OBSERVATION'};compiler={'status':'SYNTHETIC SRI COMPILER OBSERVATION'}
  plan={'format':'axiom.local-prisma-generation-preparation/1','sourceRevision':'a'*40,'packageSha256':packet['sourceBindings']['package.json']['sha256'],'lockSha256':packet['sourceBindings']['package-lock.json']['sha256'],'schemaSha256':p.SCHEMA_SHA,'node':str(self.node),'engines':self.engine_observation,'sources':generation_source,'nativeDependencies':p.engine_tools.verify_native_dependencies(self.bound)}
  def git(repo,args):
   if args[0]=='rev-parse':return b'a'*40+b'\n'
   if args[0]=='archive':return self.archive()
   if args[0]=='show':return(self.repo/args[1].split(':',1)[1]).read_bytes()
   raise AssertionError('unexpected synthetic git request')
  def install(*args):
   events.append('offline');self.assertEqual(args[0],stage);self.assertEqual(args[3],self.node);return{'status':'offline_dependencies_installed','exit':0,'network':'kernel_denied','lifecycleScriptsExecuted':False}
  def generate(*args,**kwargs):
   events.append('generate');self.assertLessEqual(kwargs['timeout'],120)
   if generation_unknown:raise p.engine_tools.Unavailable(generation_unknown if type(generation_unknown)is str else'generation_original_child_cleanup_unknown')
   generated=self.schema.replace(b' id ',b'  id ')
   for name in p.ANCHORS:self.put(stage/name,generated if name.endswith('/schema.prisma')else(self.bound/'libquery_engine-darwin-arm64.dylib.node').read_bytes()if name.endswith('.dylib.node')else b'SYNTHETIC GENERATED OR SUPPORT CODE')
   self.put(stage/'node_modules/.prisma/client/index.d.ts',b'SYNTHETIC TYPES');run=self.dest/'work/generation';outputs=p.engine_tools.verify_generated_outputs(stage,plan)
   for name in ('archive-schema.prisma','emitted-schema.prisma'):self.put(run/'tmp'/name,generated)
   self.put(run/'attempt.json',p._json({'format':'axiom.local-generation-attempt/1','sourceRevision':'a'*40,'preparation':plan,'node':p.engine_tools.stable_file_hash(self.node)}))
   self.put(run/'result.json',p._json({'format':'axiom.local-generation-result/1','status':'generated_outputs_observed_unqualified','generatedOutputsVerified':True,'generationCompatibilityVerified':False,'executionAuthorized':False,'executingIssuerIdentity':'unavailable','descendantQuiescence':'unavailable','outputs':outputs,'schemaComparison':{'kind':'canonical_formatted_scratch_bytes','semanticAttestation':'unavailable','rawArchiveSha256':p.SCHEMA_SHA,'rawGeneratedSha256':outputs['schema.prisma']['sha256'],'canonicalArchiveSha256':hashlib.sha256(generated).hexdigest(),'canonicalGeneratedSha256':hashlib.sha256(generated).hexdigest()}}));return{'status':'generated_outputs_observed_unqualified'}
  def child(command,cwd,env,log,timeout,**kwargs):
   if '--driver-child'in command:
    self.assertEqual(command[:1],['/usr/bin/sandbox-exec'])
    self.assertEqual(kwargs['file_size_limit'],512*1024*1024)
    with patch.dict(os.environ,env,clear=True):r=p.run_stage_a_driver(path)
    return (0 if r['status']=='artifact_observed'else 73),None
   if '--offline-child'in command:
    self.assertNotIn('/usr/bin/sandbox-exec',command)
    self.assertEqual(kwargs['file_size_limit'],512*1024*1024)
    with patch.dict(os.environ,env,clear=True):p.run_offline_child(path)
    return 0,None
   self.assertNotIn('/usr/bin/sandbox-exec',command);self.assertEqual(command[-1],str(stage/'scripts/emit-synthetic-fixture-producer.cjs'));self.assertEqual(kwargs['file_size_limit'],128*1024*1024);events.append('emit')
   if emit_fail:return 1,None
   prefix=("'use strict';\n{const observation=require("+json.dumps(p.PACKAGE_ROOT+'/node_modules/@axiom/verified-issuer-runtime/internal/verify-package.cjs')+").verifyPackageFiles("+json.dumps(p.PACKAGE_ROOT)+");if(!observation||observation.qualification!==\"package_file_set_verified\")throw Error(\"fixture_package_unavailable\");}\n").encode();self.put(stage/'.next/server/__axiom_private_fixture__/fixture-producer.cjs',prefix+json.dumps(p.PACKAGE_ROOT+'/node_modules/@prisma/client').encode());return 0,None
  with patch.object(p.stage_a_tools.builder,'_git_bytes_core',side_effect=lambda repo,args,commands:git(repo,args)),patch.object(p.stage_a_tools.builder,'_install_offline_core',side_effect=lambda *args:install(*args[:-1])),patch.object(p.engine_tools,'_execute_generation',side_effect=lambda *args:generate(*args[:-2],timeout=args[-2])),patch.object(p.engine_tools,'_prepare_generation',return_value=plan)as preparation,patch.object(p.engine_tools,'verify_generation_sources',return_value=generation_source),patch.object(p.engine_tools,'_verify_generation_sources',return_value=generation_source),patch.object(p.builder,'observe_build_sources',return_value=compiler),patch.object(p.engine_tools,'_run_generation_child',side_effect=child):
   result=p.execute_stage_a_packet(path)
   if result['status']=='artifact_observed':self.assertEqual(preparation.call_count,2)
  return result,events
 def test_actual_driver_and_parent_joined_positive_uses_real_file_evidence(self):
  path=self.prepare();result,events=self.joined(path);self.assertEqual(result['status'],'artifact_observed');self.assertEqual(events,['offline','generate','emit']);self.assertFalse(result['executionAuthorized']);self.assertEqual((self.dest/'outer.log').stat().st_mode&0o777,0o600);self.assertRaises(Exception,p.execute_stage_a_packet,path)
 def test_emitter_failure_is_not_replayed_or_accepted(self):
  path=self.prepare();result,events=self.joined(path,emit_fail=True);self.assertEqual(result['status'],'refused');self.assertEqual(events,['offline','generate','emit']);self.assertEqual(p._load(self.dest/'work/driver-result.json')['phase'],'emission')
 def test_unknown_generation_stops_without_emission_or_replay(self):
  path=self.prepare();result,events=self.joined(path,generation_unknown=True);self.assertEqual(result['status'],'unknown');self.assertEqual(events,['offline','generate']);self.assertRaises(Exception,p.execute_stage_a_packet,path)
 def test_altered_sql_and_binding_cannot_reuse_successful_recipe_summary(self):
  sql=self.recipe/'fixture-schema.sql';sql.write_bytes(b'ALTERED SQL');binding=p._load(self.recipe/'fixture-schema.binding.json');binding['sqlSha256']=hashlib.sha256(sql.read_bytes()).hexdigest();(self.recipe/'fixture-schema.binding.json').write_bytes(p._json(binding));self.assertRaises(Exception,self.prepare)

 def test_producer_replacement_between_content_and_binding_refuses(self):
  packet={'work':str(self.dest/'work')};target=self.dest/'work/offline/stage/.next/server/__axiom_private_fixture__/fixture-producer.cjs'
  prefix=("'use strict';\n{const observation=require("+json.dumps(p.PACKAGE_ROOT+'/node_modules/@axiom/verified-issuer-runtime/internal/verify-package.cjs')+").verifyPackageFiles("+json.dumps(p.PACKAGE_ROOT)+");if(!observation||observation.qualification!==\"package_file_set_verified\")throw Error(\"fixture_package_unavailable\");}\n").encode()
  self.put(target,prefix+json.dumps(p.PACKAGE_ROOT+'/node_modules/@prisma/client').encode());original=p._binding(target);changed=dict(original,sha256='f'*64)
  with patch.object(p,'_binding',return_value=changed):self.assertRaises(p.StageAUnavailable,p._producer,packet)

 def test_offline_cli_preserves_only_sanitized_launch_diagnostic(self):
  import ast,contextlib,io,runpy,sys
  path=self.prepare();failure=p.builder.Unavailable('git_launch_unavailable');failure.launchDiagnostic={'phase':'git_spawn','class':'OSError','errno':'EPERM'};capture=io.StringIO()
  namespace=runpy.run_path(str(Path(p.__file__)),run_name='source_only');namespace.update(__name__='__main__');namespace['run_offline_child'].__globals__.update(builder=p.builder,verify_stage_a_packet=lambda unused:p._load(path));main=ast.parse(Path(p.__file__).read_text()).body[-1]
  with patch.dict(os.environ,{'AXIOM_PRIVATE_GIT_SCRATCH':str(self.dest/'work/tmp')},clear=True),patch.object(p.stage_a_tools.builder,'_source_inputs_core',side_effect=failure),patch.object(sys,'argv',[str(Path(p.__file__)),'--offline-child',str(path)]),contextlib.redirect_stderr(capture):
   with self.assertRaises(SystemExit)as exited:exec(compile(ast.Module(body=[main],type_ignores=[]),p.__file__,'exec'),namespace)
  self.assertEqual(exited.exception.code,74);self.assertEqual(json.loads(capture.getvalue()),{'error':'stage_a_artifact_unavailable','launchDiagnostic':failure.launchDiagnostic});self.assertNotIn(str(self.dest),capture.getvalue())

 def test_generation_stdin_cleanup_uncertainty_stays_unknown_through_parent(self):
  path=self.prepare();result,events=self.joined(path,generation_unknown='generation_parent_stdin_cleanup_unknown');self.assertEqual(result['status'],'unknown');self.assertEqual(events,['offline','generate']);self.assertRaises(Exception,p.execute_stage_a_packet,path)

 def test_null_sink_binding_is_required_and_legacy_format_is_not_upgraded(self):
  path=self.prepare();packet=p._load(path)
  self.assertEqual(packet['format'],'axiom.principal-free-stage-a/2')
  self.assertEqual(packet.get('nullSink'),p._null_sink())
  packet.pop('nullSink',None);path.write_bytes(p._json(packet));self.assertRaises(Exception,p.verify_stage_a_packet,path)
 def test_changed_null_sink_refuses_before_any_child(self):
  path=self.prepare()
  with patch.object(p,'_null_sink',return_value={'changed':True}),patch.object(p.engine_tools,'_run_generation_child',side_effect=AssertionError('NO CHILD')):
   self.assertRaises(Exception,p.execute_stage_a_packet,path)
 def test_profile_delta_allows_only_literal_null_data_write(self):
  path=self.prepare();packet=p._load(path)
  with patch.object(p.engine_tools,'_generation_profile',return_value='BASE'):
   self.assertEqual(p._profile(packet,self.dest/'outer.log'),'BASE(allow file-write-data (literal "/dev/null"))')
 def test_failed_attempt_rechecks_null_sink_and_preserves_original_refusal(self):
  path=self.prepare();actual=p._null_sink()
  with patch.object(p,'_null_sink',side_effect=[actual,actual,{'changed':True}]),patch.object(p.engine_tools,'_run_generation_child',return_value=(1,None)):
   result=p.execute_stage_a_packet(path)
  self.assertEqual(result['status'],'unknown');self.assertEqual(result['finalInputCurrentness'],'unavailable');self.assertEqual(result['originalOutcome']['status'],'refused');self.assertEqual(result['originalOutcome']['reason'],'driver_refused')
 def test_foreign_device_or_owner_is_never_accepted(self):
  actual=os.lstat('/dev/null')
  for mode,uid,rdev in ((stat.S_IFREG|0o666,0,actual.st_rdev),(actual.st_mode,123,actual.st_rdev),(actual.st_mode,0,os.makedev(1,1))):
   fake=types.SimpleNamespace(st_mode=mode,st_uid=uid,st_rdev=rdev)
   with self.subTest(mode=mode,uid=uid,rdev=rdev),patch.object(p.os,'lstat',return_value=fake):self.assertRaises(Exception,p._null_sink)

 def test_boolean_owner_cannot_impersonate_integer_zero_in_packet(self):
  path=self.prepare();packet=p._load(path);packet['nullSink']['owner']=False;path.write_bytes(p._json(packet));self.assertRaises(Exception,p.verify_stage_a_packet,path)
