"""Mocked compiler/orchestration; no real command, image, mount or package operation."""
from pathlib import Path
import sys,tempfile,unittest,json,importlib.util,os
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[5]/'scripts'))
from governance_local_issuer import fixture_container_preparation as fp,container_preparation as cp,container_assembly as a

def driver():
 spec=importlib.util.spec_from_file_location('prepared_fixture_image_driver',Path(__file__).with_name('prepared-image-driver.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
class CompileStageTests(unittest.TestCase):
 def setUp(self):
  previous_mask=os.umask(0o077);os.umask(previous_mask);self.addCleanup(os.umask,previous_mask)
  self.temp=tempfile.TemporaryDirectory(dir='/private/tmp');self.addCleanup(self.temp.cleanup);self.root=Path(self.temp.name);self.root.chmod(0o700);repo=self.root/'repo';repo.mkdir(mode=0o700)
  for name,data in [(cp.SOURCE,cp.MAIN_SOURCE),(cp.SEALED_CONTROL_SOURCE,b'static int sealed_control(void){return 0;}\nvoid fixture(void){if(!sealed_control())return;}')]:
   p=repo/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data);p.chmod(0o600)
  stage=self.root/'source';fp.prepare_fixture_container(repo,stage);self.run=self.root/'operation';self.run.mkdir(mode=0o700);r=json.loads((stage/'v2-main'/cp.RECEIPT).read_bytes());self.output=Path(r['compileRecipe']['output']);self.config={'fixturePreparation':a.binding(stage/fp.RECEIPT),'containerPreparation':a.binding(stage/'v2-main'/cp.RECEIPT),'compileRecipe':r['compileRecipe'],'packageSourceRevision':'a'*40}
 def success(self,argv,cwd,environment):
  scratch=self.run/'compiler-internal';scratch.mkdir(mode=0o700);(scratch/'probe').write_bytes(b'internal directory stays traversable')
  self.output.write_bytes(b'SYNTHETIC COMPILED MAIN NOT EXECUTABLE');self.output.chmod(0o755);return {'argv':argv,'exit':0,'state':'completed','cleanup':'reaped_original_child','error':None,'elapsed_seconds':.01,'stdout':b'','stderr':b''}
 def test_exact_compile_receipt_joins_own_v3_v2_source_without_execution(self):
  with patch('governance_local_issuer.bounded_signing_tool.run',side_effect=self.success)as run:
   result=driver()._compile_main(self.config,self.run)
  record=json.loads(Path(result['path']).read_bytes());self.assertEqual(record['preparationSha256'],self.config['containerPreparation']['sha256']);self.assertEqual(record['artifact']['mode'],0o600);self.assertFalse(record['targetExecuted']);self.assertEqual(run.call_args.args[0],self.config['compileRecipe']['argv']);self.assertEqual(a._main(self.config['containerPreparation'],result)[0],record['artifact'])
 def reject_compile(self,change):
  def fail(argv,cwd,environment):return {**self.success(argv,cwd,environment),**change}
  with patch('governance_local_issuer.bounded_signing_tool.run',side_effect=fail),self.assertRaises(ValueError):driver()._compile_main(self.config,self.run)
  self.assertFalse((self.run/'container-compile.json').exists())
 def test_nonzero_compile_stops_without_success_receipt(self):self.reject_compile({'exit':1})
 def test_unknown_cleanup_stops_without_success_receipt(self):self.reject_compile({'cleanup':'unknown'})
 def test_over_time_compile_stops_without_success_receipt(self):self.reject_compile({'elapsed_seconds':11})
 def test_main_compile_failure_never_reaches_image_or_mount(self):
  import hashlib
  from types import SimpleNamespace
  from governance_local_issuer import image_inspection as inspection
  d=driver();config=dict(self.config);config.update(procedureRepo=str(self.root),runRoot=str(self.root/'unit'),packageRoot=str(self.root/'fake-package'),packageDigest='b'*64,minimumFreeBytes=1,helpers={})
  fixture=self.root/'fixture.json';fixture.write_bytes(b'{}');fixture.chmod(0o600)
  for key in ('packageManifest','materializationReceipt','fixtureDelivery','terminalSummary','sourcePreparation'):config[key]=a.binding(fixture)
  inputs=self.root/'inputs.json';inputs.write_text(json.dumps(config));d.INPUTS=inputs;d.INPUTS_SHA256=hashlib.sha256(inputs.read_bytes()).hexdigest()
  with patch.object(inspection,'FRESH_RUN_ROOT',Path(config['runRoot'])),patch.object(d.sys,'argv',['prepared']),patch('governance_local_issuer.manifest.verify_package',return_value={'packageDigest':config['packageDigest']}),patch('governance_local_issuer.fixture_delivery_inputs.verify_fixture_materialization',return_value={'packageDigest':config['packageDigest'],'mainMaterialization':config['materializationReceipt']}),patch.object(d.shutil,'disk_usage',return_value=SimpleNamespace(free=2)),patch.object(d,'_compile_main',side_effect=ValueError('compile failed')),patch.object(d.subprocess,'run')as no_image,patch.object(inspection,'inspect_image')as no_mount,self.assertRaises(ValueError):d.main()
  no_image.assert_not_called();no_mount.assert_not_called();self.assertEqual(json.loads((Path(config['runRoot'])/'result.json').read_text())['phase'],'main-compile')
 def test_compiler_source_mutation_refuses_before_record_adoption(self):
  def mutate(argv,cwd,environment):
   result=self.success(argv,cwd,environment);Path(argv[-3]).write_bytes(b'changed source');return result
  with patch('governance_local_issuer.bounded_signing_tool.run',side_effect=mutate),self.assertRaises(ValueError):driver()._compile_main(self.config,self.run)
  self.assertFalse((self.run/'container-compile.json').exists())
if __name__=='__main__':unittest.main()
