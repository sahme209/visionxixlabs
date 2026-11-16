"""Pure refusal/cleanup observations; no Windows/native/download execution."""
import importlib.util,sys,json,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
STAGED=Path(__file__).resolve().parents[1];sys.path.insert(0,str(STAGED))
spec=importlib.util.spec_from_file_location('observed_owner',STAGED/'windows_installed_acceptance.py');owner=importlib.util.module_from_spec(spec);spec.loader.exec_module(owner)
import windows_msi_observation as observation
EMPTY={'products':[],'shortcuts':[],'protocolCommands':[],'ownedPayloads':[]}
class Observations(unittest.TestCase):
 def test_missing_legacy_file_records_observation_before_refusal_and_cleans(self):
  with tempfile.TemporaryDirectory() as folder:
   base=Path(folder);old=base/'old.msi';new=base/'new.msi';old.write_bytes(b'old');new.write_bytes(b'new');calls=[];receipt={'upgradeCycles':[]}
   class Runner:
    deadline=10**12;output=base
    def run(self,label,args,cwd,limit,**kw):
     calls.append(label)
     if label.endswith('-old-install'):(base/'msi-major-upgrade'/'msi-major-upgrade').mkdir(parents=True)
     return ''
   evidence={'productState':5,'requestedPayload':{'provided':True,'regularFile':False},'componentState':3,'componentPath':{'insideOwnedRoot':True,'matchesRequestedPath':False},'installLog':{'componentActions':[{'installed':'Local','request':'Local','action':'Null'}]}}
   legacy={kind:{'path':old,'metadata':{'ProductCode':'{OLD}'}} for kind in ['msi','nsis']};metadata={kind:{'ProductCode':'{NEW}','sha256':owner.digest(new)} for kind in ['msi','nsis']}
   with patch('windows_upgrade_acceptance.LEGACY_ASSETS',{kind:{'sha256':owner.digest(old),'bytes':3} for kind in ['msi','nsis']}),patch.object(owner,'upgrade_snapshot',return_value=EMPTY),patch.object(owner,'require_webview_runtime',return_value={}),patch.object(owner,'product_state',return_value=-1),patch.object(observation,'observe_legacy_setup',return_value=evidence):
    with self.assertRaisesRegex(RuntimeError,'artifact_not_regular'):owner.run_upgrade_cycle(Runner(),{'msiexec.exe':'fixed','pwsh.exe':'fixed'},base,'msi-major-upgrade',legacy,{kind:new for kind in ['msi','nsis']},metadata,'0.1.23',{'msi':'a'*64,'nsis':'b'*64},receipt)
   row=receipt['upgradeCycles'][0];self.assertEqual(row['legacySetupObservation'],evidence);self.assertFalse(row['oldInstallConfirmed']);self.assertFalse(row['upgradeConfirmed']);self.assertTrue(row['cleanupConfirmed']);self.assertIn('msi-major-upgrade-uninstall-0',calls);self.assertIn('msi-major-upgrade-uninstall-1',calls);self.assertNotIn('msi-major-upgrade-candidate',calls)
 def test_known_component_fixed_action_enums_not_arbitrary_log_content(self):
  with tempfile.TemporaryDirectory() as folder:
   p=Path(folder)/'msi.log';p.write_bytes(('Component: ExactMain; Installed: Local; Request: Local; Action: Null;\r\nComponent: Foreign; Installed: Local; Request: Local; Action: Local;\r\nComponent: ExactMain; Installed: secret; Request: Local; Action: Hidden;\r\nProperty(S): PASSWORD = do-not-emit\r\n').encode('utf-16-le'))
   result=observation.log_evidence(p,Path(folder),Path(folder)/'install','ExactMain')
   self.assertEqual(result['componentActions'],[{'installed':'Local','request':'Local','action':'Null'},{'installed':'UNRECOGNIZED','request':'Local','action':'UNRECOGNIZED'}]);self.assertNotIn('do-not-emit',json.dumps(result));self.assertNotIn('secret',json.dumps(result));self.assertFalse(result['rawTextEmitted'])
if __name__=='__main__':unittest.main()
