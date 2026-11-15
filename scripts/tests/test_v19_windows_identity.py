"""Pure regression of pinned templates/config, never Windows/installer execution."""
import hashlib,json,re,unittest,uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
UPSTREAM_SHA='d00089d3b1a2c4a30d7b6e098079100cb8f25e980f84d4515aca4597b95e967d'
LEGACY_KEY_LINE='!define LEGACYPRODUCTNAME "Axiom Agent"\n'
OLD_MATCH='    StrCmp "$R0$R1" "${PRODUCTNAME}${MANUFACTURER}" 0 wix_loop'
NEW_MATCH='    StrCmp "$R0$R1" "${PRODUCTNAME}${MANUFACTURER}" v19_wix_name_matches\n    StrCmp "$R0$R1" "${LEGACYPRODUCTNAME}${MANUFACTURER}" 0 wix_loop\n  v19_wix_name_matches:'

class WindowsIdentity(unittest.TestCase):
 def setUp(self):
  self.config=json.loads((ROOT/'desktop/src-tauri/tauri.conf.json').read_text())
  self.template=(ROOT/'desktop/src-tauri/windows/installer.nsi').read_text()
 def test_msi_legacy_guid_uses_actual_dns_v5_algorithm_not_renamed_default(self):
  expected=uuid.uuid5(uuid.NAMESPACE_DNS,'Axiom Agent.exe.app.x64')
  raw=bytearray(hashlib.sha1(uuid.NAMESPACE_DNS.bytes+b'Axiom Agent.exe.app.x64').digest()[:16]);raw[6]=(raw[6]&15)|80;raw[8]=(raw[8]&63)|128
  self.assertEqual(expected,uuid.UUID(bytes=bytes(raw)))
  self.assertEqual(str(expected),self.config['bundle']['windows']['wix']['upgradeCode'])
  self.assertNotEqual(expected,uuid.uuid5(uuid.NAMESPACE_DNS,'V19.exe.app.x64'))
 def test_preserves_internal_identity_but_installer_and_window_display_v19(self):
  self.assertEqual(self.config['productName'],'V19');self.assertEqual(self.config['app']['windows'][0]['title'],'V19')
  self.assertEqual(self.config['identifier'],'com.visionxixlabs.axiom');self.assertEqual(self.config['plugins']['deep-link']['desktop']['schemes'],['axiom-agent'])
  self.assertEqual(self.config['bundle']['windows']['nsis']['template'],'windows/installer.nsi')
  self.assertIn('Name "${PRODUCTNAME}"',self.template);self.assertIn('VIAddVersionKey "ProductName" "${PRODUCTNAME}"',self.template)
 def test_only_registry_identity_and_previous_wix_match_differ_from_pinned_upstream(self):
  self.assertEqual(self.template.count(LEGACY_KEY_LINE),1);self.assertEqual(self.template.count(NEW_MATCH),1)
  migration=self.template[self.template.index('\n; V19 rename:'):self.template.index('Function FindWixInstall')]
  base=self.template.replace(migration,'')
  base=base.replace('Function CreateOrUpdateDesktopShortcut\n  StrCpy $R0 0\n','Function CreateOrUpdateDesktopShortcut\n')
  base=re.sub(r'^    !insertmacro V19RemoveOwnedLegacyShortcut .*\n','',base,flags=re.M)
  base=re.sub(r'^  !insertmacro V19MigrateOwnedLegacyShortcut .*\n','',base,flags=re.M)
  base=base.replace('Function CreateOrUpdateDesktopShortcut\n  ${If} $R0 = 1\n    Return\n  ${EndIf}\n','Function CreateOrUpdateDesktopShortcut\n')
  restored=base.replace(LEGACY_KEY_LINE,'').replace('Uninstall\\${LEGACYPRODUCTNAME}','Uninstall\\${PRODUCTNAME}').replace('"${MANUKEY}\\${LEGACYPRODUCTNAME}"','"${MANUKEY}\\${PRODUCTNAME}"').replace(NEW_MATCH,OLD_MATCH)
  self.assertEqual(hashlib.sha256(restored.encode()).hexdigest(),UPSTREAM_SHA)
 def test_legacy_nsis_keys_preserve_path_and_uninstall_for_every_arch_without_publisher_change(self):
  values={'PRODUCTNAME':'V19','LEGACYPRODUCTNAME':'Axiom Agent','MANUFACTURER':'visionxixlabs'}
  for key in ('MANUKEY','MANUPRODUCTKEY','UNINSTKEY'):
   value=re.search(r'^!define '+key+r' "(.*)"$',self.template,re.M).group(1)
   for name,replacement in values.items():value=value.replace('${'+name+'}',replacement)
   values[key]=value
  self.assertEqual(values['UNINSTKEY'],r'Software\Microsoft\Windows\CurrentVersion\Uninstall\Axiom Agent')
  self.assertEqual(values['MANUPRODUCTKEY'],r'Software\visionxixlabs\Axiom Agent')
  restore=self.template.split('Function RestorePreviousInstallLocation\n',1)[1].split('FunctionEnd',1)[0]
  self.assertIn('ReadRegStr $4 SHCTX "${MANUPRODUCTKEY}" ""',restore)
  self.assertIn('ReadRegStr $R1 SHCTX "${UNINSTKEY}" "UninstallString"',self.template)
  self.assertIn('DeleteRegKey SHCTX "${UNINSTKEY}"',self.template)
  self.assertIn('StrCpy $INSTDIR "$LOCALAPPDATA\\${PRODUCTNAME}"',self.template)
  # Unchanged upstream SetContext governs per-user/per-machine and architecture;
  # our three identity definitions contain no architecture-dependent branch.
  self.assertNotIn('${ARCH}',values['UNINSTKEY']+values['MANUPRODUCTKEY'])
 def test_msi_transition_lookup_keeps_both_names_with_same_publisher_and_original_uninstall_flow(self):
  self.assertIn(NEW_MATCH,self.template)
  function=self.template.split('Function FindWixInstall\n',1)[1].split('FunctionEnd',1)[0]
  self.assertIn('"${PRODUCTNAME}${MANUFACTURER}"',function);self.assertIn('"${LEGACYPRODUCTNAME}${MANUFACTURER}"',function)
  self.assertIn('"msiexec"',function)
  self.assertIn('!define MANUFACTURER "{{manufacturer}}"',self.template)

if __name__=='__main__':unittest.main()
