import importlib.util,sys,tempfile,unittest,json
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[2] if Path(__file__).parent.name=='tests' else Path('/Users/samirahmed/.codex/worktrees/axiom-governance-recovery-2026-11-14')
sys.path.insert(0,str(ROOT/'scripts'));sys.path.insert(0,str(Path(__file__).parent))
SOURCE=Path(__file__).with_name('windows_legacy_reinstall_diagnostic.py')
if not SOURCE.exists():SOURCE=ROOT/'scripts/windows_legacy_reinstall_diagnostic.py'
s=importlib.util.spec_from_file_location('legacy_reinstall',SOURCE);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class Diagnostic(unittest.TestCase):
 def test_log_only_allowlisted_properties_and_codes_no_arbitrary_secret(self):
  with tempfile.TemporaryDirectory() as folder:
   p=Path(folder)/'msi.log';p.write_bytes(('Property(S): INSTALLDIR = C:\\owned\\install\r\nProperty(S): SourceDir = C:\\owned\\source\r\nProperty(S): SECRET_PASSWORD = do-not-emit\r\nMainEngineThread is returning 0\r\n').encode('utf-16-le'))
   with patch.object(m,'path_evidence',return_value={'provided':True,'insideOwnedRoot':True}):r=m.log_evidence(p,Path('C:/owned'),Path('C:/owned/install'))
   self.assertEqual(set(r['properties']),{'INSTALLDIR','SourceDir'});self.assertEqual(r['mainEngineReturnCodes'],[0]);self.assertNotIn('do-not-emit',json.dumps(r));self.assertFalse(r['rawTextEmitted'])
 def test_outside_component_never_reads_file(self):
  with patch.object(m.qa,'windows_path_within',return_value=False),patch.object(Path,'is_file',side_effect=AssertionError('outside file inspected')):
   r=m.path_evidence(r'C:\\foreign\\axiom-desktop.exe',Path(r'D:\\owner'),Path(r'D:\\owner\\axiom-desktop.exe'))
  self.assertFalse(r['insideOwnedRoot']);self.assertFalse(r['outsideOwnedFileRead']);self.assertNotIn('sha256',r)
 def test_lexical_owned_parent_link_escape_refused_before_file_inspection(self):
  with tempfile.TemporaryDirectory() as folder,tempfile.TemporaryDirectory() as outside:
   base=Path(folder);(base/'escaped-parent').symlink_to(Path(outside),target_is_directory=True);value=base/'escaped-parent'/'axiom-desktop.exe'
   with patch.object(m.qa,'windows_path_identity',side_effect=lambda value:value),patch.object(m.qa,'windows_path_within',return_value=True),patch.object(Path,'is_file',side_effect=AssertionError('unowned file inspected')):
    result=m.path_evidence(str(value),base,value)
   self.assertTrue(result['physicalOwnershipRefused']);self.assertFalse(result['regularFile']);self.assertNotIn('bytes',result);self.assertNotIn('sha256',result)
 def test_component_api_fixed_guid_and_bounded_buffer(self):
  class Call:
   def __call__(self,product,component,buf,size):buf.value=r'C:\owned\axiom-desktop.exe';size._obj.value=len(buf.value);return 3
  class API:MsiGetComponentPathW=Call()
  with patch.object(m.ctypes,'WinDLL',return_value=API(),create=True) as dll:
   state,value=m.component_location('{11111111-1111-1111-1111-111111111111}','{22222222-2222-2222-2222-222222222222}')
   self.assertEqual(state,3);self.assertTrue(value.endswith('axiom-desktop.exe'));self.assertEqual(dll.call_args.args,('msi',))
  with self.assertRaisesRegex(RuntimeError,'component_guid_invalid'):m.component_location('unsafe','unsafe')
 def test_noadmin_and_admin_cases_remain_distinct_and_native_build_absent(self):
  source=Path(m.__file__).read_text();self.assertIn("('shallow-no-admin'",source);self.assertIn("('nested-no-admin'",source);self.assertIn("('shallow-after-admin'",source);self.assertIn("('nested-after-admin'",source);self.assertIn("if label=='shallow-after-admin':",source);self.assertIn("result['adminCleanupConfirmed']=False",source);self.assertIn("result.get('adminCleanupConfirmed',True)",source);self.assertNotIn('tauri.js',source);self.assertNotIn('cargo.exe',source)
if __name__=='__main__':unittest.main()
