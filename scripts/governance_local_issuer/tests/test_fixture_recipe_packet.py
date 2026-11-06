"""Synthetic files + mocked child supervisor only; no Node/engine/restriction run."""
from pathlib import Path
import hashlib,json,os,sys,tempfile,unittest
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).parents[2]))
from governance_local_issuer import fixture_recipe_packet as p
from governance_local_issuer import manifest
class RecipePacketTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory(prefix='axiom-recipe-packet-test-',dir='/private/tmp');self.addCleanup(self.tmp.cleanup);self.root=Path(self.tmp.name);self.root.chmod(0o700);self.repo=self.root/'repo';self.repo.mkdir(mode=0o700);self.package=self.root/'accepted';self.package.mkdir(mode=0o700)
  self.schema=b'datasource db {\n  url      = env("DATABASE_URL")\n}\nmodel Example {\n id String @id\n}\n';self.seed=b'-- synthetic seed\n';self.node=self.root/'node';self.node.write_bytes(b'FAKE NODE NEVER EXECUTE');self.node.chmod(0o755)
  for name,data in {'prisma/schema.prisma':self.schema,'lib/governance/qualification/fixture-seed.sql':self.seed,'scripts/prepare-synthetic-fixture-recipe.cjs':b'FAKE HELPER','scripts/synthetic-fixture-recipe-driver.cjs':b'FAKE DRIVER','node_modules/@prisma/engines/schema-engine-darwin-arm64':b'FAKE ENGINE NEVER EXECUTE'}.items():
   path=self.repo/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
  self.engine=self.repo/'node_modules/@prisma/engines/schema-engine-darwin-arm64';self.engine.chmod(0o755)
  for name,data in {'.next/BUILD_ID':b'fakebuild','.next/required-server-files.json':b'{"files":[".next/BUILD_ID"]}','node_modules/next/dist/bin/next':b'FAKE NEXT','__axiom_runtime__/node':b'FAKE RUNTIME','node_modules/prisma/build/index.js':b'FAKE CLI','node_modules/@prisma/engines/dist/index.js':b'FAKE ENGINES MODULE'}.items():
   path=self.package/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
  (self.package/'__axiom_runtime__/node').chmod(0o755);receipt=self.package.parent/'materialization.json';receipt.write_text('{"format":"axiom.local-issuer-materialization/1"}');self.digest=manifest.write_manifest(self.package,{'sourceRevision':'a'*40,'archiveSha256':'b'*64,'buildReceiptSha256':'c'*64,'materializationReceiptSha256':hashlib.sha256(receipt.read_bytes()).hexdigest()},'v24.21.0')
  for key,value in {'NODE_PATH':str(self.node),'NODE_SHA':hashlib.sha256(self.node.read_bytes()).hexdigest(),'ENGINE_SHA':hashlib.sha256(self.engine.read_bytes()).hexdigest(),'SCHEMA_SHA':hashlib.sha256(self.schema).hexdigest()}.items():patcher=patch.object(p,key,value);patcher.start();self.addCleanup(patcher.stop)
  self.dest=self.root/'new-packet'
 def prepare(self):return p.prepare_recipe_packet(self.repo,self.package,self.node,self.engine,self.dest,'f'*40,self.digest)
 def test_actual_manifest_view_and_clean_profile_no_authority(self):
  path=self.prepare();packet=p.verify_recipe_packet(path);self.assertFalse(packet['executionAuthorized']);self.assertEqual(os.readlink(self.dest/'input-view/node_modules'),str(self.package/'node_modules'));self.assertEqual((self.dest/'input-view/prisma/schema.prisma').read_bytes(),self.schema);self.assertEqual(packet['engine']['path'],str(self.engine));self.assertEqual(packet['acceptedPackage']['digest'],self.digest);self.assertNotIn('deny file-read',packet['sandboxProfile']);self.assertIn('(deny network*)',packet['sandboxProfile']);self.assertEqual(path.stat().st_mode&0o777,0o600)
 def test_changed_or_extra_accepted_dependency_and_view_alias_refuse(self):
  path=self.prepare();extra=self.package/'node_modules/extra';extra.write_bytes(b'extra');self.assertRaises(Exception,p.verify_recipe_packet,path);extra.unlink();(self.dest/'input-view/node_modules').unlink();(self.dest/'input-view/node_modules').symlink_to(self.repo/'node_modules');self.assertRaises(Exception,p.verify_recipe_packet,path)
 def test_nonexec_engine_or_existing_destination_refuses_before_packet(self):
  self.engine.chmod(0o644);self.assertRaises(Exception,self.prepare);self.assertFalse(self.dest.exists());self.engine.chmod(0o755);self.dest.mkdir();self.assertRaises(Exception,self.prepare)
 def test_owned_attempt_before_mock_supervisor_and_no_retry(self):
  path=self.prepare();calls=[]
  def run(command,stage,environment,log,timeout,**kw):
   calls.append(command);self.assertTrue((self.dest/'attempt.json').is_file());self.assertTrue((self.dest/'result.json').is_file());self.assertEqual(timeout,60);self.assertEqual(environment['CHECKPOINT_DISABLE'],'1');self.assertNotIn('DATABASE_URL',environment);self.assertEqual(command[0],'/usr/bin/sandbox-exec');return 1,'synthetic_nonzero'
  with patch.object(p.engine_tools,'_run_generation_child',side_effect=run):result=p.execute_recipe_packet(path)
  self.assertEqual(len(calls),1);self.assertEqual(result['status'],'refused');self.assertFalse(result['executionAuthorized']);self.assertRaises(Exception,p.execute_recipe_packet,path)
 def successful_child(self,packet):
  work=Path(packet['work']);schema=self.schema.replace(b'url      = env("DATABASE_URL")',b'url      = "postgresql://qualification.invalid/qualification"');sql=b'CREATE TABLE "Example" (id text);\n';seed=self.seed
  binding={'format':'axiom.synthetic-fixture-schema/1','schemaSha256':p.SCHEMA_SHA,'engineSha256':p.ENGINE_SHA,'diffInputSha256':packet['diffInputSha256'],'sqlSha256':hashlib.sha256(sql).hexdigest(),'seedSha256':hashlib.sha256(seed).hexdigest(),'models':['Example'],'completeSchema':True,'qualification':False}
  (work/'recipe').mkdir(mode=0o700)
  for name,data in [('prepared-schema.prisma',schema),('stdout.raw',sql),('stderr.raw',b''),('recipe/fixture-schema.sql',sql),('recipe/fixture-seed.sql',seed),('recipe/fixture-schema.binding.json',p._json(binding))]:p._write(work/name,data)
  cwd=str(work/'tmp/axiom-schema-only-synthetic');environment={'NODE_ENV':'production','PRISMA_SCHEMA_ENGINE_BINARY':packet['engine']['path'],'PRISMA_HIDE_UPDATE_MESSAGE':'true','CHECKPOINT_DISABLE':'1','PRISMA_GENERATE_SKIP_AUTOINSTALL':'true','HOME':str(work/'home'),'TMPDIR':str(work/'tmp'),'XDG_CACHE_HOME':str(work/'home'),'PATH':str(self.node.parent)+':/usr/bin:/bin:/usr/sbin:/sbin','LANG':'C','TZ':'UTC'}
  child={'format':'axiom.fixed-recipe-child/1','status':'exited_zero','exit':0,'argv':[str(self.node),packet['repo']+'/node_modules/prisma/build/index.js','migrate','diff','--from-empty','--to-schema-datamodel',cwd+'/schema.prisma','--script'],'cwd':cwd,'environment':environment,'preparedInputSha256':packet['diffInputSha256'],'stdout':{'sha256':hashlib.sha256(sql).hexdigest(),'reportedSize':len(sql),'retainedSize':len(sql)},'stderr':{'sha256':hashlib.sha256(b'').hexdigest(),'reportedSize':0,'retainedSize':0}}
  p._write(work/'child.json',p._json(child));p._write(work/'driver-result.json',p._json({'format':'axiom.fixed-recipe-driver-result/1','status':'exported','binding':binding,'executionAuthorized':False}))
 def test_mocked_success_rechecks_real_manifest_and_exact_output_joins(self):
  path=self.prepare();packet=p.verify_recipe_packet(path)
  def run(*args,**kw):self.successful_child(packet);return 0,None
  with patch.object(p.engine_tools,'_run_generation_child',side_effect=run)as child:result=p.execute_recipe_packet(path)
  self.assertEqual(result['status'],'exported');self.assertEqual(child.call_count,1);self.assertEqual(len(result['outputs']),8);self.assertRaises(Exception,p.execute_recipe_packet,path)
 def test_post_child_engine_metadata_change_cannot_be_recorded_success(self):
  path=self.prepare();packet=p.verify_recipe_packet(path)
  def run(*args,**kw):self.successful_child(packet);self.engine.chmod(0o644);return 0,None
  with patch.object(p.engine_tools,'_run_generation_child',side_effect=run):result=p.execute_recipe_packet(path)
  self.assertEqual(result['status'],'refused');self.assertTrue((self.dest/'work/recipe/fixture-schema.sql').exists());self.assertEqual(result['stage'],'postlaunch');self.assertEqual(result['reason'],'stable_regular_input_required')
 def test_success_shaped_wrong_cli_record_is_refused_without_retry(self):
  path=self.prepare();packet=p.verify_recipe_packet(path)
  def run(*args,**kw):
   self.successful_child(packet);record=self.dest/'work/child.json';value=json.loads(record.read_text());value['argv'][2]='db';record.write_text(json.dumps(value));return 0,None
  with patch.object(p.engine_tools,'_run_generation_child',side_effect=run)as child:result=p.execute_recipe_packet(path)
  self.assertEqual(result['status'],'refused');self.assertEqual(child.call_count,1)
 def test_coherent_changed_view_seed_refuses_before_launch(self):
  path=self.prepare();packet=json.loads(path.read_text());view=self.dest/'input-view/lib/governance/qualification/fixture-seed.sql';view.write_bytes(b'CHANGED SEED');binding=p._file(view);packet['viewBindings'][1]=binding;packet['inputs'][7]=binding;path.write_text(json.dumps(packet));self.assertRaises(Exception,p.verify_recipe_packet,path)
 def test_source_materialization_receipt_change_refuses_before_launch(self):
  path=self.prepare();receipt=self.package.parent/'materialization.json';receipt.write_bytes(b'changed');self.assertRaises(Exception,p.verify_recipe_packet,path)
 def test_json_load_uses_only_one_stable_bounded_fd_read(self):
  path=self.prepare()
  with patch.object(Path,'read_bytes',side_effect=RuntimeError('forbidden unbounded reread')):self.assertEqual(p._load(path)['format'],p.FORMAT)
 def test_wrong_binding_format_or_extra_key_cannot_be_exported(self):
  for kind in ('format','extra'):
   self.dest=self.root/('packet-'+kind);path=self.prepare();packet=p.verify_recipe_packet(path)
   def run(*args,**kw):
    self.successful_child(packet);binding_path=self.dest/'work/recipe/fixture-schema.binding.json';binding=json.loads(binding_path.read_text());binding[kind]='wrong' if kind=='format' else True;binding_path.write_text(json.dumps(binding));result_path=self.dest/'work/driver-result.json';result=json.loads(result_path.read_text());result['binding']=binding;result_path.write_text(json.dumps(result));return 0,None
   with patch.object(p.engine_tools,'_run_generation_child',side_effect=run):result=p.execute_recipe_packet(path)
   self.assertEqual(result['status'],'refused')
 def test_unknown_supervisor_exception_records_only_fixed_phase_and_code(self):
  path=self.prepare()
  with patch.object(p.engine_tools,'_run_generation_child',side_effect=RuntimeError('private-value-must-not-appear')):result=p.execute_recipe_packet(path)
  self.assertEqual(result['stage'],'supervisor');self.assertEqual(result['reason'],'packet_or_export_unavailable');self.assertNotIn('private-value',json.dumps(result))
