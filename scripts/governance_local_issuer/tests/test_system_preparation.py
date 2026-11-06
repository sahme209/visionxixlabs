"""Actual owned staging effects; no native compiler/signature/runtime invocation."""
from pathlib import Path
import hashlib, json, os, plistlib, sys, tempfile, unittest
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).parents[2]))
from governance_local_issuer import system_preparation as s
class SystemPreparationTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory(prefix='axiom-system-preparation-',dir='/private/tmp');self.addCleanup(self.temp.cleanup)
  self.root=Path(self.temp.name);self.root.chmod(0o700);self.repo=self.root/'repo';self.repo.mkdir(mode=0o700)
  self.node=self.root/'node';self.node.write_bytes(b'FIXED NODE INPUT NOT EXECUTABLE');self.node.chmod(0o600)
  self.headers=self.root/'headers';self.headers.mkdir(mode=0o700)
  for name in ('node_api.h','node_api_types.h','js_native_api.h','js_native_api_types.h'):(self.headers/name).write_text('HEADER '+name)
  # Representative production include graph, using distinct fixed literal bytes.
  for name in s.ROLE_SOURCE_PATHS:
   p=self.repo/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text('SOURCE '+name+'\n#include "fixture.h"\n')
  native=self.repo/'packages/verified-issuer-runtime/native';(native/'fixture.h').write_text('#define FIXTURE 1\n')
  for name in s.PACKAGE_SOURCE_PATHS:
   p=self.repo/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text('PRIVATE PACKAGE '+name)
  self.config={'format':'axiom.system-preparation-config/1','generation':s.GENERATION,'principal':{'account':'_axiomissuer_synthetic','uid':503,'gid':503},'lifetimeNs':60000000000,'nativeProfile':'hardened-runtime-no-exceptions/1','systemProfile':'trusted-owner-root-journal/1','team':'FG5N98FE6W','node':{'path':str(self.node),'sha256':hashlib.sha256(self.node.read_bytes()).hexdigest(),'headers':str(self.headers)},'requirements':{'node':'cdhash H"'+'1'*40+'"','controller':'cdhash H"'+'2'*40+'"','brokerForGuard':'cdhash H"'+'3'*40+'"'}}
  self.stage=self.root/'new-stage'
 def test_actual_stage_contains_fixed_plist_source_copy_and_closed_recipes(self):
  before=hashlib.sha256(self.node.read_bytes()).hexdigest();r=s.prepare_system(self.repo,self.stage,self.config)
  app=self.stage/'assembly/Axiom Synthetic Custodian.app'
  self.assertTrue((app/'Contents/Info.plist').is_file())
  plist=plistlib.loads((self.stage/'assembly/LaunchDaemons'/f'{s.OWNER_SERVICE}.plist').read_bytes())
  self.assertEqual(plist['ProgramArguments'],[s.OWNER_PATH]);self.assertEqual(plist['MachServices'],{s.OWNER_SERVICE:True,s.BROKER_SERVICE:True,s.REQUEST_SERVICE:True});self.assertFalse(plist['KeepAlive']);self.assertFalse(plist['RunAtLoad'])
  self.assertFalse(r['executionAuthorized']);self.assertFalse(r['installationReady']);self.assertFalse(r['activationAllowed'])
  self.assertIn('actual_installation_and_runtime_qualification_missing',r['unresolved'])
  roles={x['role']:x for x in r['compileRecipes']}
  self.assertEqual(set(roles),{'owner','broker','controller','maintenance','bootstrap','guard'})
  self.assertIn(str(self.stage/'source/packages/verified-issuer-runtime/native/system_peer_binding.c'),roles['owner']['argv'])
  self.assertIn(str(self.stage/'source/packages/verified-issuer-runtime/native/origin_private_resource_supplier.m'),roles['broker']['argv'])
  self.assertIn(str(self.stage/'source/packages/verified-issuer-runtime/native/synthetic_resource_maintenance_main.c'),roles['maintenance']['argv']);self.assertFalse(any((Path(x['output'])).exists() for x in roles.values()))
  config=(self.stage/'config/system-preparation.h').read_text();self.assertIn('AX_OWNER_PROFILE 2',config);self.assertNotIn('AX_OWNER_OPERATIONAL 1',config)
  self.assertEqual((self.stage/'source/packages/verified-issuer-runtime/native/fixture.h').read_bytes(),b'#define FIXTURE 1\n')
  self.assertTrue((self.stage/'payload/__axiom_runtime__/node').is_file());self.assertEqual((self.stage/'payload/__axiom_runtime__/node').read_bytes(),self.node.read_bytes());self.assertEqual(before,hashlib.sha256(self.node.read_bytes()).hexdigest())
  for p in self.stage.rglob('*'):
   self.assertEqual(p.stat().st_mode&0o777,0o700 if p.is_dir() else 0o600)
 def test_missing_principal_refuses_before_creating_stage(self):
  del self.config['principal'];self.assertRaises(s.SystemPreparationUnavailable,s.prepare_system,self.repo,self.stage,self.config);self.assertFalse(self.stage.exists())
 def test_root_principal_and_unknown_profile_refuse(self):
  for field,value in [('principal',{'account':'_axiomissuer_synthetic','uid':0,'gid':503}),('systemProfile','legacy-per-user'),('team','OTHER')]:
   c=dict(self.config);c[field]=value;self.assertRaises(s.SystemPreparationUnavailable,s.prepare_system,self.repo,self.stage,c);self.assertFalse(self.stage.exists())
 def test_existing_stage_is_immutable_and_never_cleaned(self):
  self.stage.mkdir(mode=0o700);(self.stage/'prior').write_bytes(b'KEEP');self.assertRaises(s.SystemPreparationUnavailable,s.prepare_system,self.repo,self.stage,self.config);self.assertEqual((self.stage/'prior').read_bytes(),b'KEEP')
 def test_changed_node_and_symlink_source_refuse_without_stage(self):
  self.node.write_bytes(b'CHANGED');self.assertRaises(s.SystemPreparationUnavailable,s.prepare_system,self.repo,self.stage,self.config);self.assertFalse(self.stage.exists())
  self.config['node']['sha256']=hashlib.sha256(self.node.read_bytes()).hexdigest();p=self.repo/'packages/verified-issuer-runtime/native/system_peer_binding.c';p.unlink();p.symlink_to(self.node)
  self.assertRaises(s.SystemPreparationUnavailable,s.prepare_system,self.repo,self.stage,self.config);self.assertFalse(self.stage.exists())
 def test_legacy_stage_and_native_overlay_are_not_touched(self):
  old=self.repo/'historical';old.mkdir();f=old/'attempt.json';f.write_bytes(b'consumed');oldmod=self.repo/'scripts/governance_local_issuer/native_overlay.py';oldmod.parent.mkdir(parents=True,exist_ok=True);oldmod.write_bytes(b'OLD MODULE')
  s.prepare_system(self.repo,self.stage,self.config);self.assertEqual(f.read_bytes(),b'consumed');self.assertEqual(oldmod.read_bytes(),b'OLD MODULE')
 def test_current_staging_verification_detects_mutation(self):
  r=s.prepare_system(self.repo,self.stage,self.config);self.assertTrue(s.verify_preparation(self.stage))
  target=self.stage/'source/packages/verified-issuer-runtime/native/system_peer_binding.c';target.write_bytes(b'CHANGED');self.assertRaises(s.SystemPreparationUnavailable,s.verify_preparation,self.stage)
 def test_header_mutation_during_copy_is_rejected(self):
  original=s._write
  def mutate(path,data):
   original(path,data)
   if str(path).endswith('/headers/node_api.h'):(self.headers/'node_api.h').write_bytes(b'CHANGED AFTER COPY')
  with patch.object(s,'_write',side_effect=mutate):
   self.assertRaises(s.SystemPreparationUnavailable,s.prepare_system,self.repo,self.stage,self.config)
  self.assertFalse((self.stage/s.RECEIPT).exists())
 def test_receipt_permissions_cannot_be_broadened(self):
  s.prepare_system(self.repo,self.stage,self.config)
  (self.stage/s.RECEIPT).chmod(0o644)
  self.assertRaises(s.SystemPreparationUnavailable,s.verify_preparation,self.stage)
 def test_native_leaves_phase_does_not_require_or_fake_future_broker_hash(self):
  r=s.prepare_system(self.repo,self.stage,self.config,phase='native-leaves')
  self.assertEqual({x['role']for x in r['compileRecipes']},{'owner','broker','controller','maintenance','bootstrap'})
  self.assertNotIn('AXIOM_ISSUER_BROKER_REQUIREMENT',(self.stage/'config/system-preparation.h').read_text())
  self.assertIn('guard_requires_actual_signed_broker',r['unresolved'])
  self.assertFalse(r['executionAuthorized']);self.assertFalse(r['installationReady'])
  self.assertTrue(s.verify_preparation(self.stage))
 def test_unapproved_principal_name_refuses_before_stage(self):
  self.config['principal']['account']='_axiom_custodian'
  self.assertRaises(s.SystemPreparationUnavailable,s.prepare_system,self.repo,self.stage,self.config)
  self.assertFalse(self.stage.exists())
 def test_native_leaves_accepts_no_future_guard_requirement(self):
  del self.config['requirements']['brokerForGuard']
  r=s.prepare_system(self.repo,self.stage,self.config,phase='native-leaves')
  self.assertNotIn('guard',{x['role']for x in r['compileRecipes']})
  self.assertFalse((self.stage/'payload/node').exists())
  self.assertTrue((self.stage/'payload/__axiom_runtime__/node').is_file())
 def test_controller_first_needs_no_future_code_requirement(self):
  self.config['requirements']={}
  try:r=s.prepare_system(self.repo,self.stage,self.config,phase='controller-first')
  except s.SystemPreparationUnavailable as error:self.fail('controller-first must prepare without future hashes: '+str(error))
  self.assertEqual([x['role']for x in r['compileRecipes']],['controller'])
  config=(self.stage/'config/system-preparation.h').read_text()
  self.assertNotIn('AXIOM_ISSUER_NODE_REQUIREMENT',config)
  self.assertNotIn('AXIOM_ISSUER_CONTROLLER_REQUIREMENT',config)
  self.assertNotIn('AXIOM_ISSUER_BROKER_REQUIREMENT',config)
  self.assertIn('native_leaves_require_actual_node_and_controller',r['unresolved'])
  self.assertFalse(r['installationReady']);self.assertFalse(r['executionAuthorized'])
  self.assertTrue(s.verify_preparation(self.stage))
 def test_payload_module_files_are_copied_and_later_mutation_refused(self):
  s.prepare_system(self.repo,self.stage,self.config)
  module=self.stage/'payload/node_modules/@axiom/verified-issuer-runtime'
  for name in ('package.json','index.cjs','index.d.ts','README.md','internal/verify-package.cjs'):
   self.assertTrue((module/name).is_file())
   self.assertEqual((module/name).read_bytes(),(self.repo/'packages/verified-issuer-runtime'/name).read_bytes())
  self.assertFalse((module/'native/origin_guard.node').exists())
  self.assertTrue(s.verify_preparation(self.stage))
  (module/'internal/verify-package.cjs').write_bytes(b'CHANGED MODULE')
  self.assertRaises(s.SystemPreparationUnavailable,s.verify_preparation,self.stage)
 def test_independent_leaves_need_no_future_code_requirements(self):
  self.config['requirements']={}
  try:r=s.prepare_system(self.repo,self.stage,self.config,phase='independent-leaves')
  except s.SystemPreparationUnavailable as error:self.fail('independent leaves must prepare without future hashes: '+str(error))
  self.assertEqual([x['role']for x in r['compileRecipes']],['owner','maintenance','bootstrap'])
  config=(self.stage/'config/system-preparation.h').read_text()
  self.assertNotIn('AXIOM_ISSUER_NODE_REQUIREMENT',config)
  self.assertNotIn('AXIOM_ISSUER_CONTROLLER_REQUIREMENT',config)
  self.assertNotIn('AXIOM_ISSUER_BROKER_REQUIREMENT',config)
  self.assertIn('controller_broker_guard_requirements_pending',r['unresolved'])
  self.assertFalse(r['installationReady']);self.assertFalse(r['executionAuthorized']);self.assertFalse(r['activationAllowed'])
  self.assertTrue(s.verify_preparation(self.stage))
 def test_broker_leaf_compiles_outside_app_before_any_assembly(self):
  del self.config['requirements']['brokerForGuard']
  try:r=s.prepare_system(self.repo,self.stage,self.config,phase='broker-leaf')
  except s.SystemPreparationUnavailable as error:self.fail('detached broker preparation required: '+str(error))
  self.assertEqual([x['role'] for x in r['compileRecipes']],['broker'])
  recipe=r['compileRecipes'][0];output=Path(recipe['output'])
  self.assertEqual(output,self.stage/'leaves/AxiomIssuerBroker')
  self.assertFalse(any(x.suffix=='.app' for x in output.parents))
  self.assertEqual(recipe['argv'][recipe['argv'].index('-o')+1],str(output))
  self.assertFalse(output.exists());self.assertFalse(recipe['execute'])
  header=(self.stage/'config/system-preparation.h').read_text()
  self.assertIn('AXIOM_ISSUER_NODE_REQUIREMENT',header);self.assertIn('AXIOM_ISSUER_CONTROLLER_REQUIREMENT',header)
  self.assertNotIn('AXIOM_ISSUER_BROKER_REQUIREMENT',header)
  self.assertIn('broker_leaf_requires_separate_signature_and_final_assembly',r['unresolved'])
  self.assertFalse(r['installationReady']);self.assertFalse(r['activationAllowed']);self.assertTrue(s.verify_preparation(self.stage))
if __name__=='__main__':unittest.main()
