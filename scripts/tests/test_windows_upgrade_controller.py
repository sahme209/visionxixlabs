"""Owned orchestration with synthetic files/mocked Windows APIs. No native use."""
import hashlib,importlib.util,json,sys,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
SOURCE=Path(__file__).resolve().parents[1]/'windows_installed_acceptance.py'
sys.path.insert(0,str(SOURCE.parent))
spec=importlib.util.spec_from_file_location('upgrade_owner',SOURCE);owner=importlib.util.module_from_spec(spec);spec.loader.exec_module(owner)
EMPTY={'products':[],'shortcuts':[],'protocolCommands':[],'ownedPayloads':[]}
OLD={**EMPTY,'products':[{'displayName':'Axiom Agent','version':'0.1.21'}],'shortcuts':[{'path':'old.lnk'}],'protocolCommands':[['synthetic','%1']]}
class Cycle(unittest.TestCase):
 def run_case(self,case,fail=False,preexisting=False):
  folder=tempfile.TemporaryDirectory();self.addCleanup(folder.cleanup);root=Path(folder.name);calls=[];runner=None
  old=root/'old.exe';new=root/'new.exe';old.write_bytes(b'old');new.write_bytes(b'new')
  legacy={kind:{'path':old,'metadata':{'ProductCode':'{OLD}'}} for kind in ['msi','nsis']};candidates={kind:new for kind in ['msi','nsis']};metadata={kind:{'ProductCode':'{NEW}','sha256':owner.digest(new)} for kind in ['msi','nsis']}
  install=root/case/('msi-major-upgrade' if case.startswith('msi') else 'nsis-update' if case.startswith('nsis-collision') else case)
  executable=install/'axiom-desktop.exe';uninstaller=install/'uninstall.exe'
  payloads={'msi':b'new-msi-app','nsis':b'new-nsis-app'}
  payload_hashes={kind:hashlib.sha256(value).hexdigest() for kind,value in payloads.items()}
  expected_kind='msi' if case=='msi-major-upgrade' else 'nsis'
  audits=[]
  def audit(_state,*,executable,sha256,version):
   self.assertEqual(sha256,payload_hashes[expected_kind]);self.assertEqual(owner.digest(executable),sha256);self.assertEqual(version,'0.1.23');audits.append(expected_kind);return {'upgradeObserved':True}
  class Runner:
   deadline=10**12;output=root
   def run(self,label,args,cwd,limit,**kw):
    calls.append((label,args,kw))
    if label.endswith('-old-install'):
     install.mkdir(parents=True);executable.write_bytes(b'old-app');uninstaller.write_bytes(b'uninstaller')
    if label.endswith('-candidate'):
     if fail:raise RuntimeError('synthetic_candidate_failure')
     executable.write_bytes(payloads[expected_kind])
    if label.endswith('-uninstall') or '-uninstall-' in label:
     executable.unlink(missing_ok=True)
     if '-uninstall-' in label:uninstaller.unlink(missing_ok=True)
    if label.endswith('-collision-create'):return json.dumps({'sha256':'a'*64})
    if '-collision-' in label:return json.dumps({'preserved':True,'removed':True})
    return ''
  runner=Runner();receipt={'upgradeCycles':[]}
  def snapshot(*args):
   label=args[-1]
   if label.endswith('-pristine'):return OLD if preexisting else EMPTY
   if label.endswith('-old-state'):return OLD
   return EMPTY
  with patch('windows_upgrade_acceptance.LEGACY_ASSETS',{kind:{'sha256':owner.digest(old),'bytes':old.stat().st_size} for kind in ['msi','nsis']}),patch.object(owner,'upgrade_snapshot',side_effect=snapshot),patch.object(owner,'require_webview_runtime',return_value={}),patch.object(owner,'product_state',return_value=-1),patch.object(owner,'pe_machine',return_value=0x8664),patch.object(owner,'protocol_args_match',return_value=True),patch('windows_upgrade_acceptance.upgrade_audit',side_effect=audit):
   if fail or preexisting:
    with self.assertRaises(RuntimeError):owner.run_upgrade_cycle(runner,{'pwsh.exe':'fixed-pwsh.exe','msiexec.exe':'fixed-msiexec.exe'},root,case,legacy,candidates,metadata,'0.1.23',payload_hashes,receipt)
   else:owner.run_upgrade_cycle(runner,{'pwsh.exe':'fixed-pwsh.exe','msiexec.exe':'fixed-msiexec.exe'},root,case,legacy,candidates,metadata,'0.1.23',payload_hashes,receipt)
  if not fail and not preexisting and not case.startswith('nsis-collision'):
   self.assertEqual(audits,[expected_kind])
  return calls,receipt
 def test_update_cycle_installs_old_then_upgrades_launches_and_cleans_owned_uninstaller(self):
  calls,receipt=self.run_case('nsis-update');labels=[row[0] for row in calls]
  self.assertLess(labels.index('nsis-update-old-install'),labels.index('nsis-update-candidate'))
  self.assertLess(labels.index('nsis-update-candidate'),labels.index('nsis-update-uninstall'))
  self.assertTrue(receipt['upgradeCycles'][0]['cleanupConfirmed'])
 def test_msi_major_upgrade_cleans_only_both_admitted_product_codes(self):
  calls,receipt=self.run_case('msi-major-upgrade')
  cleanup=[row for row in calls if '-uninstall-' in row[0]]
  self.assertEqual([row[1][2] for row in cleanup],['{OLD}','{NEW}'])
  self.assertTrue(receipt['upgradeCycles'][0]['upgradeConfirmed']);self.assertTrue(receipt['upgradeCycles'][0]['cleanupConfirmed'])
 def test_partial_candidate_failure_still_uninstalls_owned_cycle(self):
  calls,receipt=self.run_case('nsis-update',fail=True)
  self.assertIn('nsis-update-uninstall',[row[0] for row in calls]);self.assertTrue(receipt['upgradeCycles'][0]['cleanupConfirmed'])
 def test_preexisting_state_refuses_before_install_or_uninstall_is_armed(self):
  calls,_=self.run_case('nsis-update',preexisting=True);self.assertEqual(calls,[])
 def test_both_collision_cases_require_exit_two_and_preservation_through_uninstall(self):
  for slot in ['legacy','current']:
   case='nsis-collision-'+slot;calls,receipt=self.run_case(case)
   row=next(row for row in calls if row[0].endswith('-candidate'));self.assertEqual(row[2]['allow'],(2,))
   self.assertTrue(receipt['upgradeCycles'][0]['foreignPreservedThroughUninstall']);self.assertTrue(receipt['upgradeCycles'][0]['cleanupConfirmed'])
if __name__=='__main__':unittest.main()
