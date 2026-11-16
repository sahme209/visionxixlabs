"""Source/fixture contracts only; real COM/WSH/MSI qualification is separate."""
import ast,hashlib,importlib.util,json,re,sys,unittest,uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];SOURCE=(ROOT/'desktop/src-tauri/windows/msi-shortcut-migration.vbs').read_text()
sys.path.insert(0,str(ROOT/'scripts'))
import windows_msi_shortcut_preflight as fixture
class UninstallShortcutContract(unittest.TestCase):
 def test_component_identity_is_pinned_bundle_identifier_uuid_not_product_name(self):
  namespace=uuid.UUID('fd8595a8-17a3-474e-a616-76148dfa0c7b');config=json.loads((ROOT/'desktop/src-tauri/tauri.conf.json').read_text())
  expected='{'+str(uuid.uuid5(namespace,config['identifier'])).upper()+'}'
  self.assertIn('Const V19MainComponent = "'+expected+'"',SOURCE)
  self.assertEqual(expected,'{EB234B33-5646-54DC-BC0A-9794A161CA82}')
 def test_capture_uses_actual_related_product_api_name_publisher_and_component_path(self):
  capture=SOURCE.split('Sub CaptureRelatedOwnership',1)[1].split('End Sub',1)[0]
  for needle in ['Set installed = RelatedProducts()','installed.Count > 16','InstalledProductInfo(code, "InstalledProductName")','InstalledProductInfo(code, "Publisher")','InstalledProductInfo(code, "VersionString")','InstalledComponentPath(code)','<> LCase(expected)']:self.assertIn(needle,capture)
  self.assertIn('Session.Installer.RelatedProducts(V19UpgradeCode)',SOURCE)
  self.assertIn('Session.Installer.ComponentPath(code, V19MainComponent)',SOURCE)
  self.assertNotIn('WIX_UPGRADE_DETECTED',SOURCE);self.assertNotIn('InstallLocation',SOURCE);self.assertNotIn('version <> "0.1.21"',SOURCE)
 def test_immediate_capture_precedes_unregistration_and_overwrites_deferred_data(self):
  main=SOURCE.split('Select Case V19Phase',1)[0]
  self.assertIn('CaptureRelatedOwnership',main)
  preflight=SOURCE.split('Case "preflight"',1)[1].split('Case "migrate"',1)[0]
  for phase in ['Rollback','Migrate','Commit']:self.assertIn('WriteProperty "V19'+phase+'LegacyShortcuts", data',preflight)
  self.assertIn('UBound(parts) <> 4',main);self.assertIn('UBound(parts) <> 8',main)
  self.assertIn('legacyCodes = ValidatedGuidList(parts(7))',main)
 def test_third_slot_has_same_ownership_rechecks_for_move_rollback_commit(self):
  self.assertIn('expected & ".v19-legacy-uninstall.lnk"',SOURCE)
  migrate=SOURCE.split('Case "migrate"',1)[1].split('Case "rollback"',1)[0]
  self.assertLess(migrate.index('CheckUninstallOwned uninstallLinks(0), legacyCodes'),migrate.index('fso.MoveFile uninstallLinks(0), backups(2)'))
  rollback=SOURCE.split('Case "rollback"',1)[1].split('Case "commit"',1)[0]
  self.assertLess(rollback.index('CheckUninstallOwned backups(2), legacyCodes'),rollback.index('fso.MoveFile backups(2), uninstallLinks(0)'))
  self.assertIn('Shortcut rollback destination occupied',rollback)
  commit=SOURCE.split('Case "commit"',1)[1].split('Case Else',1)[0]
  self.assertLess(commit.index('CheckUninstallOwned backups(2), legacyCodes'),commit.index('fso.DeleteFile backups(2), False'))
  self.assertNotIn('DeleteFolder',SOURCE)
 def test_root_link_requires_system_target_exact_uninstall_argument_and_captured_guid(self):
  check=SOURCE.split('Sub CheckUninstallOwned',1)[1].split('End Sub',1)[0]
  for needle in ['CheckRegular value','<> LCase(systemMsi)','Len(arguments) <> 41','LCase(Left(arguments, 3)) <> "/x "','CanonicalGuid(Mid(arguments, 4))','Not HasGuid(codes, code)']:self.assertIn(needle,check)
  self.assertIn('CheckUninstallDestination uninstallLinks(1), currentCodes',SOURCE)
 def test_two_application_link_ownership_and_move_are_retained(self):
  for needle in ['If shortcut.Arguments <> "" Then Fail "Shortcut arguments preserved"','<> LCase(expected)','fso.MoveFile links(i), backups(i)','fso.MoveFile backups(i), links(i)','fso.DeleteFile backups(i), False']:self.assertIn(needle,SOURCE)
 def test_synthetic_adapter_replaces_only_session_boundary_and_does_not_claim_real_products(self):
  for phase in ['preflight','migrate','rollback','commit']:
   rendered=fixture.fixture_script(SOURCE,phase,'C:\\fixture\\axiom-desktop.exe|a|b|c|d')
   self.assertNotIn('Session.',rendered);self.assertIn('V19FixtureProperties',rendered);self.assertIn('Synthetic product lookup unexpected',rendered)
   self.assertIn('V19_SHORTCUT_FIXTURE_COMPLETE',rendered)
  with self.assertRaises(RuntimeError):fixture.fixture_script(SOURCE+'\nSession.Installer.Unreviewed()', 'preflight','data')
 def test_qa_pins_exact_template_and_inline_source(self):
  template=(ROOT/'desktop/src-tauri/windows/main.wxs').read_bytes();controller=(ROOT/'scripts/windows_installed_acceptance.py').read_text()
  self.assertIn(hashlib.sha256(template).hexdigest(),controller)
  for phase in ['preflight','migrate','rollback','commit']:self.assertIn(SOURCE.replace('__PHASE__',phase),template.decode())
if __name__=='__main__':unittest.main()
