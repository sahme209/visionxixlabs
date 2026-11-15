"""Pure source-contract checks; not NSIS execution or Windows qualification."""
from pathlib import Path
import unittest,re,hashlib
ROOT=Path(__file__).resolve().parents[2]
class Proposal(unittest.TestCase):
 def setUp(self):self.s=(ROOT/'desktop/src-tauri/windows/installer.nsi').read_text()
 def macro(self,name):return self.s.split('!macro '+name+' ',1)[1].split('!macroend',1)[0]
 def function(self,name):return self.s.split('Function '+name+'\n',1)[1].split('FunctionEnd',1)[0]
 def test_existing_pinned_target_macro_is_reused_without_any_new_plugin(self):
  guard=self.macro('V19RequireAbsentOrOwnedShortcut')
  self.assertIn('!insertmacro IsShortcutTarget "${path}" "$INSTDIR\\${MAINBINARYNAME}.exe"',guard)
  self.assertLess(guard.index('IsShortcutTarget'),guard.index('Abort'))
  self.assertNotIn('Delete ',guard);self.assertNotIn('Rename ',guard)
  self.assertNotIn('!addplugindir',self.s[self.s.index('; V19 rename:'):self.s.index('Function FindWixInstall')])
 def test_rename_requires_both_ownership_checks_and_absent_destination_before_mutation(self):
  migration=self.macro('V19MigrateOwnedLegacyShortcut')
  self.assertLess(migration.index('V19RequireAbsentOrOwnedShortcut "${legacy}"'),migration.index('Rename '))
  self.assertLess(migration.index('V19RequireAbsentOrOwnedShortcut "${current}"'),migration.index('Rename '))
  collision=migration.index('V19 shortcut destination already exists.')
  self.assertLess(collision,migration.index('Rename '));self.assertIn('SetErrorLevel 2',migration[:collision])
  self.assertNotIn('Delete ',migration);self.assertNotIn('SetShortcutTarget',migration)
  self.assertIn('${If} ${Errors}',migration)
 def test_update_and_no_shortcut_paths_run_owned_migration_before_creation_suppression(self):
  for name in ['CreateOrUpdateStartMenuShortcut','CreateOrUpdateDesktopShortcut']:
   function=self.function(name)
   self.assertLess(function.index('V19MigrateOwnedLegacyShortcut'),function.index('$UpdateMode = 1'))
   self.assertLess(function.index('V19MigrateOwnedLegacyShortcut'),function.index('$NoShortcutMode = 1'))
  self.assertIn('${If} $R0 = 1\n    Return',self.function('CreateOrUpdateDesktopShortcut'))
 def test_uninstall_deletes_legacy_only_inside_exact_target_guard(self):
  body=self.macro('V19RemoveOwnedLegacyShortcut');self.assertLess(body.index('IsShortcutTarget'),body.index('${If} $0 = 1'));self.assertLess(body.index('${If} $0 = 1'),body.index('Delete "${path}"'))
  self.assertEqual(self.s.count('!insertmacro V19RemoveOwnedLegacyShortcut'),3)
 def test_only_declared_added_macros_and_six_calls_plus_desktop_return_differ(self):
  s=self.s
  block=s[s.index('\n; V19 rename:'):s.index('Function FindWixInstall')]
  s=s.replace(block,'')
  # Original has exactly one blank line before FindWixInstall; added block owns
  # its leading newline but not the pre-existing one.
  s=s.replace('Function CreateOrUpdateDesktopShortcut\n  StrCpy $R0 0\n','Function CreateOrUpdateDesktopShortcut\n')
  s=re.sub(r'^    !insertmacro V19RemoveOwnedLegacyShortcut .*\n','',s,flags=re.M)
  s=re.sub(r'^  !insertmacro V19MigrateOwnedLegacyShortcut .*\n','',s,flags=re.M)
  anchor='Function CreateOrUpdateDesktopShortcut\n  ${If} $R0 = 1\n    Return\n  ${EndIf}\n'
  s=s.replace(anchor,'Function CreateOrUpdateDesktopShortcut\n')
  self.assertEqual(hashlib.sha256(s.encode()).hexdigest(),'66778255726e1942228d157b7ef3c2b00232def3e630c98efee85139dca42da6')
if __name__=='__main__':unittest.main()
