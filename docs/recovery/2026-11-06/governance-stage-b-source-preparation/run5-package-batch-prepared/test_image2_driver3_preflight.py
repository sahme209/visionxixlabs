"""Full driver with real postcompile main inventory; image/host effects mocked."""
from pathlib import Path
import sys,json,hashlib,unittest,importlib.util
from contextlib import ExitStack
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[5]/'scripts'))
from governance_local_issuer import container_assembly as a,container_preparation as cp,fixture_container_preparation as fp,fixture_delivery_inputs as fixture,manifest,image_inspection as inspection
spec=importlib.util.spec_from_file_location('reuse_fixture',Path(__file__).with_name('test_prepared_image2_driver.py'));reuse=importlib.util.module_from_spec(spec);spec.loader.exec_module(reuse)
class ImageStubReached(Exception):pass
class Driver3PreflightTests(unittest.TestCase):
 def setUp(self):
  self.f=reuse.ExistingMainReuseTests();self.f.setUp();self.addCleanup(self.f.doCleanups);self.run=self.f.f.root/'image2';self.module=self.load();self.config=dict(self.f.config);dummy=self.f.receipt
  self.config.update(procedureRepo=str(self.f.f.root),helpers={},runRoot=str(self.run),imagePath=str(self.run/'image/issuer-package.dmg'),assemblyDestination=str(self.run/'assembled'),packageRoot=str(self.run.parent/'2026-11-06-stage-b-materialization-2/package'),packageSourceRevision='b8b0314c39324ba3a918fd0f6672faf0297c2041',packageDigest='b'*64,minimumFreeBytes=1,imageMaximumBytes=1024*1024,imageSeconds=600)
  for key in ['packageManifest','materializationReceipt','fixtureDelivery','terminalSummary','sourcePreparation']:self.config[key]=a.binding(dummy)
  self.packet=self.f.f.root/'image-inputs.json';self.packet.write_text(json.dumps(self.config));self.packet.chmod(0o600)
  prepared=json.loads(Path(self.config['containerPreparation']['path']).read_text());self.prepstage=Path(prepared['staging']);self.assertEqual(len([p for p in self.prepstage.rglob('*')if p.is_file()]),len(prepared['files'])+2)
 def load(self):
  spec=importlib.util.spec_from_file_location('driver3_under_test',Path(__file__).with_name('prepared-image2-driver3.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
 def context(self):
  stack=ExitStack();m=self.module
  stack.enter_context(patch.multiple(m,INPUTS=self.packet,INPUTS_SHA256=hashlib.sha256(self.packet.read_bytes()).hexdigest(),MAIN_PREPARATION=self.config['containerPreparation'],MAIN_COMPILE=self.config['containerCompile'],FIXTURE_PREPARATION=self.config['fixturePreparation']))
  stack.enter_context(patch.object(sys,'argv',['fixed-driver3']))
  stack.enter_context(patch.object(inspection,'IMAGE2_ROOT',self.run))
  stack.enter_context(patch.object(manifest,'verify_package',return_value={'packageDigest':'b'*64}))
  stack.enter_context(patch.object(fixture,'verify_fixture_materialization',return_value={'packageDigest':'b'*64,'mainMaterialization':self.config['materializationReceipt']}))
  self.disk=stack.enter_context(patch.object(m.shutil,'disk_usage',return_value=type('Disk',(),{'free':10**9})()))
  stack.enter_context(patch.object(m.resource,'getrlimit',return_value=(m.resource.RLIM_INFINITY,m.resource.RLIM_INFINITY)));stack.enter_context(patch.object(m.resource,'setrlimit'))
  self.image=stack.enter_context(patch.object(m.subprocess,'run',side_effect=ImageStubReached('mock image boundary')))
  return stack
 def test_authentic_postcompile_inventory_reaches_image_stub(self):
  with self.context(),patch.object(a,'_main',wraps=a._main)as join,self.assertRaises(ImageStubReached):self.module.main()
  self.assertEqual(self.image.call_count,1);self.assertGreaterEqual(join.call_count,2)
 def test_changed_declared_unsigned_refuses_before_host_or_image(self):
  self.f.f.output.write_bytes(b'changed')
  with self.context(),self.assertRaises(ValueError):self.module.main()
  self.disk.assert_not_called();self.image.assert_not_called();self.assertFalse(self.run.exists())
 def test_changed_original_source_refuses_before_host_or_image(self):
  prepared=json.loads(Path(self.config['containerPreparation']['path']).read_text());Path(prepared['source']['path']).write_bytes(b'changed source')
  with self.context(),self.assertRaises(ValueError):self.module.main()
  self.disk.assert_not_called();self.image.assert_not_called();self.assertFalse(self.run.exists())
if __name__=='__main__':unittest.main()
