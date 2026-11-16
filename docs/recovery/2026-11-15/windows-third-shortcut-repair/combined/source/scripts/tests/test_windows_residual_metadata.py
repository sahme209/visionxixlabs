import importlib.util,unittest,tempfile,hashlib,os,ast,sys
from types import SimpleNamespace
from pathlib import Path
from unittest.mock import patch
p=Path(__file__).resolve().parents[1]/'windows_residual_metadata.py';spec=importlib.util.spec_from_file_location('residual',p);r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
class Residuals(unittest.TestCase):
 def test_empty_and_exact_small_file_hash_without_contents(self):
  with tempfile.TemporaryDirectory() as d:
   base=Path(d);self.assertFalse(r.installation_residual_metadata(base)['directoryPresent']);folder=base/'application';folder.mkdir();(folder/'Uninstall Axiom Agent.lnk').write_bytes(b'fictional link');out=r.installation_residual_metadata(base);self.assertEqual(out['entries'],[{'relativeName':'Uninstall Axiom Agent.lnk','type':'file','sizeBytes':14,'sha256':hashlib.sha256(b'fictional link').hexdigest()}]);self.assertNotIn('fictional',str(out))
 def test_symlinks_never_followed_or_hashed(self):
  with tempfile.TemporaryDirectory() as d,tempfile.TemporaryDirectory() as outside:
   b=Path(d);f=b/'application';f.mkdir();(Path(outside)/'secret').write_bytes(b'PRIVATE');(f/'foreign').symlink_to(outside,target_is_directory=True);(f/'link').symlink_to(Path(outside)/'secret')
   with patch.object(r,'_read_small',side_effect=AssertionError('must not read')):out=r.installation_residual_metadata(b)
   self.assertEqual({x['type'] for x in out['entries']},{'reparse'});self.assertNotIn('PRIVATE',str(out));self.assertNotIn(outside,str(out))
 def test_reparse_attribute_refuses_windows_style_junction(self):
  class St:st_mode=0o100600;st_file_attributes=0x400
  self.assertTrue(r.reparse(St()))
 def test_entry_depth_and_hash_byte_limits(self):
  with tempfile.TemporaryDirectory() as d:
   b=Path(d);f=b/'application';f.mkdir();(f/'deep').mkdir();(f/'deep'/'stop').mkdir();(f/'deep'/'stop'/'private').write_text('PRIVATE')
   for n in range(40):(f/str(n)).write_bytes(b'x'*65536)
   out=r.installation_residual_metadata(b);self.assertLessEqual(len(out['entries']),32);self.assertTrue(out['entryLimitReached']);self.assertTrue(out['depthLimitReached']);self.assertLessEqual(out['hashBytes'],256*1024);self.assertNotIn('PRIVATE',str(out))
 def test_large_files_not_read_and_changed_leaf_refuses(self):
  with tempfile.TemporaryDirectory() as d:
   b=Path(d);f=b/'application';f.mkdir();p=f/'large';p.write_bytes(b'x'*65537)
   with patch.object(r,'_read_small',side_effect=AssertionError('must not read')):self.assertTrue(r.installation_residual_metadata(b)['entries'][0]['hashSkippedBound'])
   st=p.lstat();p.write_bytes(b'changed')
   with self.assertRaises(OSError):r._read_small(p,st)
 def test_msi_utf16_tail_keeps_final_error_with_raw_bound(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'msi.log';p.write_bytes(b'\xff\xfe'+('early '*2000+'FINAL_ERROR_1603').encode('utf-16-le'));out=r.bounded_msi_log_tail(p);self.assertIn('FINAL_ERROR_1603',out['tailText']);self.assertLessEqual(out['tailBytes'],4096);self.assertEqual(out['tailOffsetBytes']%2,0);self.assertTrue(out['tailTruncated'])
 def test_small_utf8_tail_and_controls(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'msi.log';p.write_bytes(b'final\x00\x1b failure');out=r.bounded_msi_log_tail(p);self.assertEqual(out['tailText'],'final failure');self.assertFalse(out['tailTruncated'])
 def test_shortcut_script_is_fixed_readonly_bounded_and_does_not_emit_unknown_args(self):
  text=(p.parent/'windows_residual_shortcuts.ps1').read_text()
  for forbidden in ['.Save(','.Resolve(', 'Start-Process','Remove-Item','TargetPath=','arguments=$args']:
   self.assertNotIn(forbidden,text)
  for required in ["$seen -lt 32","$current[1] -lt 1","ReparsePoint","System32\\msiexec.exe","argumentsAreUninstallGuid","'legacy'","'candidate'","'other-guid'"]:
   self.assertIn(required,text)
 def test_original_residual_failure_survives_collector_exception(self):
  text=(p.parent/'windows_installed_acceptance.py').read_text();tree=ast.parse(text);function=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='run_upgrade_cycle')
  blocks=[n.finalbody for n in ast.walk(function) if isinstance(n,ast.Try) and any(isinstance(x,ast.ImportFrom) and x.module=='windows_residual_metadata' for x in n.finalbody)]
  if not blocks:
   blocks=[n.body for n in ast.walk(function) if isinstance(n,ast.Try) and any(isinstance(x,ast.ImportFrom) and x.module=='windows_residual_metadata' for x in n.body)]
  body=blocks[0];start=next(i for i,n in enumerate(body) if isinstance(n,ast.ImportFrom) and n.module=='windows_residual_metadata');end=next(i for i,n in enumerate(body) if isinstance(n,ast.Expr) and isinstance(n.value,ast.Call) and any(isinstance(a,ast.Constant) and a.value=='upgrade_install_directory_residuals' for a in n.value.args));nodes=body[start:end+1]
  with tempfile.TemporaryDirectory() as d:
   b=Path(d);install=b/'application';install.mkdir();(install/'leftover').write_bytes(b'owned')
   def broken(_):raise RuntimeError('PRIVATE')
   def need(ok,code):
    if not ok:raise RuntimeError(code)
   row={};env={'row':row,'base':b,'install':install,'need':need};fake=SimpleNamespace(installation_residual_metadata=broken)
   with patch.dict(sys.modules,{'windows_residual_metadata':fake}),self.assertRaisesRegex(RuntimeError,'^upgrade_install_directory_residuals$'):exec(compile(ast.Module(body=nodes,type_ignores=[]),'pure-residual-hook','exec'),env)
   self.assertTrue(row['installationDirectoryResidualMetadata']['metadataUnavailable']);self.assertNotIn('PRIVATE',str(row))
if __name__=='__main__':unittest.main()
