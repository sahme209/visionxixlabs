"""Ordinary synthetic provenance files only; no compiler/image/host call."""
from pathlib import Path
import sys,json,importlib.util,unittest
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[5]/'scripts'))
from governance_local_issuer import container_preparation as cp,container_assembly as a
spec=importlib.util.spec_from_file_location('old_prepared_image_test',Path(__file__).parents[1]/'image-v3-1-prepared/test_prepared_image_driver.py');fixtures=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixtures)
def driver():
 spec=importlib.util.spec_from_file_location('new_image2_driver',Path(__file__).with_name('prepared-image2-driver.py'));module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
class ExistingMainReuseTests(unittest.TestCase):
 def setUp(self):
  self.f=fixtures.CompileStageTests();self.f.setUp();self.addCleanup(self.f.doCleanups);self.f.output.write_bytes(b'SYNTHETIC PRIOR COMPILE NOT EXECUTABLE');self.f.output.chmod(0o600);self.config=self.f.config;prepared=json.loads(Path(self.config['containerPreparation']['path']).read_text())
  value={'sourceRevision':'a'*40,'stage':prepared['staging'],'preparationSha256':self.config['containerPreparation']['sha256'],'argv':prepared['compileRecipe']['argv'],'compilerExit':0,'state':'completed','targetExecuted':False,'companySigningKeyUsed':False,'appAssembled':False,'installationReady':False,'activationAllowed':False,'runtimeIdentityQualified':False,'originalInputClosureUnchanged':True,'onlyDeclaredOutputAdded':True,'artifact':a.binding(self.f.output)}
  self.receipt=self.f.root/'original-container-compile.json';self.receipt.write_text(json.dumps(value));self.receipt.chmod(0o600);self.config['containerCompile']=a.binding(self.receipt);self.module=driver()
 def context(self):return patch.multiple(self.module,MAIN_PREPARATION=self.config['containerPreparation'],FIXTURE_PREPARATION=self.config['fixturePreparation'],MAIN_COMPILE=self.config['containerCompile'])
 def test_original_genuine_compile_proof_reused_without_compiler_or_restamp(self):
  original=self.receipt.read_bytes()
  with self.context(),patch('governance_local_issuer.bounded_signing_tool.run',side_effect=AssertionError('compiler forbidden'))as no_compile:
   result=self.module._reuse_main(self.config,self.f.run)
  self.assertEqual(result,self.config['containerCompile']);self.assertEqual(self.receipt.read_bytes(),original);no_compile.assert_not_called();self.assertFalse((self.f.run/'container-compile.json').exists());self.assertFalse(json.loads((self.f.run/'main-reuse-observation.json').read_text())['recompiled'])
 def test_changed_unsigned_or_source_refuses_without_compiler(self):
  self.f.output.write_bytes(b'CHANGED')
  with self.context(),patch('governance_local_issuer.bounded_signing_tool.run')as no_compile,self.assertRaises(ValueError):self.module._reuse_main(self.config,self.f.run)
  no_compile.assert_not_called();self.assertFalse((self.f.run/'main-reuse-observation.json').exists())
 def test_other_compile_binding_cannot_be_adopted(self):
  modified=dict(self.config);modified['containerCompile']={**modified['containerCompile'],'path':str(self.f.root/'elsewhere.json')}
  with self.context(),self.assertRaises(ValueError):self.module._reuse_main(modified,self.f.run)
 def test_changed_original_source_refuses_existing_compile_proof(self):
  prepared=json.loads(Path(self.config['containerPreparation']['path']).read_text());Path(prepared['source']['path']).write_bytes(b'changed original source')
  with self.context(),patch('governance_local_issuer.bounded_signing_tool.run')as no_compile,self.assertRaises(ValueError):self.module._reuse_main(self.config,self.f.run)
  no_compile.assert_not_called();self.assertFalse((self.f.run/'main-reuse-observation.json').exists())
if __name__=='__main__':unittest.main()
