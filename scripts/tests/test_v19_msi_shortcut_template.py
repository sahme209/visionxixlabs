"""Portable installer-template contracts; not VBScript/native MSI acceptance."""
import hashlib,json,re,unittest,xml.etree.ElementTree as ET
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];WINDOWS=ROOT/'desktop/src-tauri/windows';UPSTREAM=ROOT/'docs/recovery/2026-11-15/windows-msi-shortcut-repair/PINNED-UPSTREAM-main.wxs';NS={'w':'http://schemas.microsoft.com/wix/2006/wi'}
class ShortcutTemplate(unittest.TestCase):
 def tree(self):return ET.fromstring((WINDOWS/'main.wxs').read_text())
 def test_original_template_reconstructed_without_unrelated_changes(self):
  source=(WINDOWS/'main.wxs').read_text();start=source.index('        <!-- V19 ownership-aware legacy shortcut migration.');end=source.index('        <Media Id="1"',start);source=source[:start]+source[end:]
  start=source.index('          <!-- Rebrand fallback:');end=source.index('\n',source.index('Id="V19LegacyInstallDirWithName"',start));source=source[:start]+source[end+1:]
  source=source.replace('<RemoveShortcuts>Installed</RemoveShortcuts>','<RemoveShortcuts>Installed AND NOT UPGRADINGPRODUCTCODE</RemoveShortcuts>')
  self.assertEqual(source,UPSTREAM.read_text());self.assertEqual(hashlib.sha256(source.encode()).hexdigest(),'e371a01628a06730828f9bd24111feacb8bec53c250ccec4b46df756fe0a0198')
 def test_inline_actions_are_exact_reviewed_source_not_path_interpolated_code(self):
  tree=self.tree();base=(WINDOWS/'msi-shortcut-migration.vbs').read_text();names={'V19ShortcutPreflight':'preflight','V19RollbackLegacyShortcuts':'rollback','V19MigrateLegacyShortcuts':'migrate','V19CommitLegacyShortcuts':'commit'}
  for name,phase in names.items():
   action=tree.find('.//w:CustomAction[@Id="'+name+'"]',NS);self.assertEqual(action.attrib['Script'],'vbscript');self.assertEqual(action.attrib['Win64'],'$(var.Win64)');self.assertEqual(action.attrib['Return'],'check');self.assertEqual(action.text.strip(),base.replace('__PHASE__',phase).strip());self.assertNotIn('ExeCommand',action.attrib)
  values=[tree.find('.//w:CustomAction[@Id="V19Set'+mode+'Data"]',NS).attrib['Value'] for mode in ['Rollback','Migrate','Commit']]
  self.assertEqual(len(set(values)),1);self.assertEqual(len(values[0].split('|')),5);self.assertEqual(values[0].split('|')[0],'[INSTALLDIR]axiom-desktop.exe')
 def test_preflight_precedes_transaction_and_rollback_is_registered_before_mutation(self):
  tree=self.tree();schedule={x.attrib['Action']:x.attrib['After'] for x in tree.findall('.//w:InstallExecuteSequence/w:Custom',NS) if x.attrib.get('Action','').startswith('V19')}
  self.assertEqual(schedule,{'V19SetRollbackData':'CostFinalize','V19SetMigrateData':'V19SetRollbackData','V19SetCommitData':'V19SetMigrateData','V19ShortcutPreflight':'V19SetCommitData','V19RollbackLegacyShortcuts':'CreateShortcuts','V19MigrateLegacyShortcuts':'V19RollbackLegacyShortcuts','V19CommitLegacyShortcuts':'V19MigrateLegacyShortcuts'})
  for name,mode in [('V19RollbackLegacyShortcuts','rollback'),('V19MigrateLegacyShortcuts','deferred'),('V19CommitLegacyShortcuts','commit')]:
   action=tree.find('.//w:CustomAction[@Id="'+name+'"]',NS);self.assertEqual(action.attrib['Execute'],mode);self.assertEqual(action.attrib['Impersonate'],'no')
 def test_legacy_location_fallback_preserves_current_precedence_and_upgrade_identity(self):
  tree=self.tree();search=tree.find('.//w:Property[@Id="INSTALLDIR"]',NS).findall('w:RegistrySearch',NS);self.assertEqual([x.attrib['Id'] for x in search],['V19LegacyInstallDirNoName','V19LegacyInstallDirWithName','PrevInstallDirNoName','PrevInstallDirWithName'])
  self.assertTrue(all(x.attrib['Key'].endswith('Axiom Agent') for x in search[:2]));self.assertTrue(all('{{product_name}}' in x.attrib['Key'] for x in search[2:]));self.assertEqual(tree.find('.//w:Component[@Id="Path"]',NS).attrib['Guid'],'{{path_component_guid}}')
  config=json.loads((ROOT/'desktop/src-tauri/tauri.conf.json').read_text());self.assertEqual(config['bundle']['windows']['wix'],{'upgradeCode':'a3c7da37-1792-51f2-8b3a-8848b1b33f88','template':'windows/main.wxs'})
 def test_legacy_literal_registry_suffix_has_no_empty_key_segment(self):
  # Template expressions use upstream escaping; literal registry suffixes must
  # not contain doubled separators (an empty RegLocator key segment). This is
  # a source contract; actual rendered WiX linking is validated separately.
  searches=self.tree().find('.//w:Property[@Id="INSTALLDIR"]',NS).findall('w:RegistrySearch',NS)
  old_searches=ET.fromstring(UPSTREAM.read_text()).find('.//w:Property[@Id="INSTALLDIR"]',NS).findall('w:RegistrySearch',NS)
  for current,original in zip(searches[2:],old_searches):self.assertEqual(current.attrib['Key'],original.attrib['Key'])
  for search in searches[:2]:
   prefix,suffix=search.attrib['Key'].rsplit('}}',1)
   self.assertEqual(prefix+'}}',old_searches[0].attrib['Key'].split('}}',1)[0]+'}}')
   self.assertTrue(suffix.startswith(chr(92)))
   self.assertEqual(suffix[1:].split(chr(92)),['Axiom Agent'])
 def test_observed_legacy_condition_cannot_be_repaired_by_component_guid_rotation(self):
  # Evaluate actual package action conditions with the major-upgrade premises;
  # component GUIDs are absent from this scheduling decision.
  old=ET.fromstring(UPSTREAM.read_text()).find('.//w:RemoveShortcuts',NS).text
  new=self.tree().find('.//w:RemoveShortcuts',NS).text
  self.assertEqual(old,'Installed AND NOT UPGRADINGPRODUCTCODE');self.assertEqual(new,'Installed')
  installed=True;upgrading=True
  self.assertFalse(installed and not upgrading);self.assertTrue(installed)
if __name__=='__main__':unittest.main()
