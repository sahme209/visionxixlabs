"""Only owned temporary-file effects; no compiler, main execution or signing."""
from pathlib import Path
import copy,hashlib,json,plistlib,sys,tempfile,unittest
sys.path.insert(0,str(Path(__file__).parents[2]))
from governance_local_issuer import container_preparation as c
class ContainerPreparationTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory(dir='/private/tmp');self.addCleanup(self.tmp.cleanup);self.root=Path(self.tmp.name);self.root.chmod(0o700)
  self.repo=self.root/'repo';self.repo.mkdir(mode=0o700)
  for name,data in ((c.SOURCE,c.MAIN_SOURCE),(c.SEALED_CONTROL_SOURCE,b'static int sealed_control(void){return 0;}\nvoid test(void){if(!sealed_control())return;}\n')):
   p=self.repo/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data);p.chmod(0o600)
  self.stage=self.root/'stage'
 def test_real_preparation_emits_fixed_main_info_recipe_and_closed_v2(self):
  r=c.prepare_container(self.repo,self.stage);self.assertEqual(c.verify_container(self.stage),r)
  info=plistlib.loads((self.stage/'metadata/Info.plist').read_bytes())
  self.assertFalse(any(p.suffix=='.app'for p in self.stage.rglob('*')))
  self.assertEqual(info['CFBundleExecutable'],'AxiomSyntheticContainerMain')
  self.assertEqual((self.stage/'source/container_main.c').read_bytes(),c.MAIN_SOURCE)
  self.assertEqual(r['compileRecipe']['argv'][-1],str(self.stage/'leaves/AxiomSyntheticContainerMain'))
  self.assertFalse(Path(r['compileRecipe']['output']).exists());self.assertEqual(r['compileRecipe']['requiredOutputMode'],0o600)
  for key in ('executionAuthorized','installationReady','activationAllowed','containerExecuted','identityQualified'):self.assertFalse(r[key])
  self.assertTrue(r['sealedControlPrerequisite']['required']);self.assertEqual(r['historicalV1'],'immutable_unresolved_broker_main_seal_cycle')
  for p in self.stage.rglob('*'):self.assertEqual(p.stat().st_mode&0o777,0o700 if p.is_dir()else 0o600)
 def test_authoritative_leaf_coordinates_and_ids_never_select_main(self):
  r=c.prepare_container(self.repo,self.stage);main=r['intendedMain']
  self.assertNotIn(main['path'],[x['path']for x in r['authoritativeLeaves'].values()]);self.assertNotIn(main['identifier'],[x['identifier']for x in r['authoritativeLeaves'].values()])
  self.assertFalse(any(a in ('container-main','container-seal')and b in r['authoritativeLeaves']for a,b in r['signTimeEdges']))
 def test_unknown_profile_and_authoritative_main_refuse(self):
  for key,value in [('profile','unknown'),('mainExecutable','AxiomIssuerBroker'),('mainIdentifier','com.visionxixlabs.axiom.synthetic.launch-owner')]:
   v=copy.deepcopy(c.CONFIGURATION);v[key]=value
   with self.assertRaises(ValueError):c.prepare_container(self.repo,self.stage,v)
   self.assertFalse(self.stage.exists())
 def test_extra_cycle_or_edge_refuses(self):
  for edge in (['container-seal','broker'],['guard','owner'],['container-main','broker']):
   v=copy.deepcopy(c.CONFIGURATION);v['signTimeEdges'].append(edge)
   with self.assertRaises(ValueError):c.prepare_container(self.repo,self.stage,v)
 def test_modified_main_source_refuses_before_staging(self):
  (self.repo/c.SOURCE).write_bytes(b'int main(void){return 0;}\n')
  with self.assertRaises(ValueError):c.prepare_container(self.repo,self.stage)
  self.assertFalse(self.stage.exists())
 def test_existing_stage_preserved_and_unchanged_old_module(self):
  old=self.root/'historical';old.mkdir();p=old/'receipt';p.write_bytes(b'IMMUTABLE');before=p.read_bytes()
  self.stage.mkdir(mode=0o700);(self.stage/'keep').write_bytes(b'DRAFT')
  with self.assertRaises(ValueError):c.prepare_container(self.repo,self.stage)
  self.assertEqual(p.read_bytes(),before);self.assertEqual((self.stage/'keep').read_bytes(),b'DRAFT')
 def test_staged_mutation_and_unexpected_output_refuse(self):
  c.prepare_container(self.repo,self.stage);(self.stage/'source/container_main.c').write_bytes(b'ALTERED')
  with self.assertRaises(ValueError):c.verify_container(self.stage)
 def test_forged_metadata_hash_cannot_select_authoritative_main(self):
  r=c.prepare_container(self.repo,self.stage);p=self.stage/'metadata/Info.plist';v=plistlib.loads(p.read_bytes());v['CFBundleExecutable']='AxiomIssuerBroker';p.write_bytes(plistlib.dumps(v,sort_keys=True))
  r['files']['metadata/Info.plist']={'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'size':p.stat().st_size};(self.stage/c.RECEIPT).write_text(json.dumps(r))
  with self.assertRaisesRegex(ValueError,'fixed_container_metadata_changed'):c.verify_container(self.stage)
 def test_compiled_output_is_not_implicitly_accepted(self):
  r=c.prepare_container(self.repo,self.stage);Path(r['compileRecipe']['output']).write_bytes(b'COMPILED BUT NOT OBSERVED')
  with self.assertRaises(ValueError):c.verify_container(self.stage)
 def test_forged_generation_or_privileged_future_mode_refuses(self):
  r=c.prepare_container(self.repo,self.stage)
  for key,value in [('generation','d'*32),('prospectiveInstalledMainMode',0o4755)]:
   altered=copy.deepcopy(r);altered[key]=value;(self.stage/c.RECEIPT).write_text(json.dumps(altered))
   with self.subTest(key=key):self.assertRaises(ValueError,c.verify_container,self.stage)
if __name__=='__main__':unittest.main()
