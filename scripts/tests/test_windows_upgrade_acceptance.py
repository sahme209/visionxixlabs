"""Pure synthetic metadata and fixed argv tests, no Windows/native execution."""
import importlib.util,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('upgrade',Path(__file__).parents[1]/'windows_upgrade_acceptance.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class Upgrade(unittest.TestCase):
 def good(self):
  exe=r'C:\owned\axiom-desktop.exe'
  return exe,{'products':[{'displayName':'V19','version':'0.1.23','publisher':'visionxixlabs'}],'ownedPayloads':[{'path':exe,'sha256':'a'*64,'machine':'AMD64','version':'0.1.23'}],'protocolCommands':[[exe,'%1']],'shortcuts':[{'path':r'C:\owned\V19.lnk','target':exe,'arguments':''}]}
 def test_complete_audit_accepts_only_current_owned_identity(self):
  exe,state=self.good();self.assertTrue(module.upgrade_audit(state,executable=exe,sha256='a'*64,version='0.1.23')['upgradeObserved'])
 def test_update_leftover_legacy_shortcut_refuses_even_when_target_is_current(self):
  exe,state=self.good();state['shortcuts'].append({'path':r'C:\owned\Axiom Agent.lnk','target':exe,'arguments':''})
  with self.assertRaisesRegex(RuntimeError,'legacy_shortcut_remains'):module.upgrade_audit(state,executable=exe,sha256='a'*64,version='0.1.23')
 def test_parallel_registration_wrong_payload_protocol_and_shortcut_refuse(self):
  for field,value in [('products',[{'displayName':'Axiom Agent','version':'0.1.21'}]),('ownedPayloads',[]),('protocolCommands',[]),('shortcuts',[{'path':r'C:\owned\V19.lnk','target':r'C:\foreign.exe','arguments':''}])]:
   exe,state=self.good();state[field]=value
   with self.assertRaises(RuntimeError):module.upgrade_audit(state,executable=exe,sha256='a'*64,version='0.1.23')
 def test_preexisting_and_residual_state_can_never_qualify_pristine_or_cleanup(self):
  _,state=self.good()
  for fn in [module.absent_before_owned_cycle,module.absent_after_cleanup]:
   with self.assertRaises(RuntimeError):fn(state)
   self.assertTrue(fn({key:[] for key in state}))
 def test_actual_old_msi_guid_must_match_source_derived_expected_guid(self):
  metadata={'sha256':module.LEGACY_ASSETS['msi']['sha256'],'bytes':5869568,'version':'0.1.21','productName':'Axiom Agent','machine':'AMD64','artifactKind':'MsiInstaller','upgradeCode':module.LEGACY_UPGRADE_CODE}
  module.admitted_legacy_metadata('msi',metadata);metadata['upgradeCode']='00000000-0000-0000-0000-000000000000'
  with self.assertRaisesRegex(RuntimeError,'actual_legacy_msi_upgrade_code_mismatch'):module.admitted_legacy_metadata('msi',metadata)
 def test_legacy_asset_wrong_bytes_or_identity_refuses(self):
  metadata={'sha256':module.LEGACY_ASSETS['nsis']['sha256'],'bytes':4023071,'version':'0.1.21','productName':'Axiom Agent','machine':'I386','artifactKind':'NsisInstaller'}
  module.admitted_legacy_metadata('nsis',metadata)
  for key,value in [('bytes',1),('sha256','0'*64),('machine','ARM64'),('version','0.1.20')]:
   with self.assertRaises(RuntimeError):module.admitted_legacy_metadata('nsis',{**metadata,key:value})
 def test_fixed_update_and_silent_argv_preserve_final_unquoted_directory(self):
  tools={'msiexec.exe':'fixed-msiexec.exe'}
  for case in module.AUTOMATED_CASES:
   plan=module.upgrade_commands(case,tools,r'C:\owned','old.exe','new.exe')
   self.assertEqual('/UPDATE' in plan['candidateUpgrade'],case=='nsis-update')
   if case.startswith('nsis'):self.assertTrue(plan['candidateUpgrade'][-1].startswith('/D='))
  with self.assertRaisesRegex(RuntimeError,'unsupported_upgrade_case'):module.upgrade_commands(module.MANUAL_CASES[0],tools,'owned','old','new')
 def test_snapshot_uses_the_real_controller_command_parser_and_bounds_protocol_text(self):
  exe,state=self.good();raw={**state,'protocolCommandStrings':['fixed-command']};del raw['protocolCommands']
  calls=[]
  value=module.normalized_snapshot(raw,lambda text:calls.append(text) or [exe,'%1'])
  self.assertEqual(calls,['fixed-command']);module.upgrade_audit(value,executable=exe,sha256='a'*64,version='0.1.23')
  with self.assertRaises(RuntimeError):module.normalized_snapshot({**raw,'protocolCommandStrings':['x'*4097]},lambda text:[])
 def test_snapshot_collector_reads_only_fixed_registry_shortcut_and_owned_payload_metadata(self):
  source=(Path(__file__).parents[1]/'windows_upgrade_snapshot.ps1').read_text()
  for forbidden in ['.Save(','.Run(','Remove-Item','Set-ItemProperty','Start-Process']:
   self.assertNotIn(forbidden,source)
  self.assertIn("@('Axiom Agent.lnk','V19.lnk')",source)
  self.assertIn("OpenSubKey",source);self.assertIn("$false",source)
  self.assertIn('Upgrade install directory escaped owner',source)
  self.assertIn('Upgrade inventory cap exceeded',source)
 def test_reviewed_recipe_retains_only_fixed_automated_cases(self):
  self.assertTrue(module.UPGRADE_RECIPE_REVIEWED);self.assertEqual(len(module.AUTOMATED_CASES),3)
if __name__=='__main__':unittest.main()
