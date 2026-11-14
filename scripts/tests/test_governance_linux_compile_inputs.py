"""Pure patch and owned filesystem checks. No fetched program is executed."""
from pathlib import Path
import hashlib,importlib.util,json,os,shutil,stat,tempfile,unittest
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('linux_compile_inputs',ROOT/'scripts/governance_linux_compile_inputs.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
VENDOR='packages/verified-issuer-runtime/linux/vendor'
PATCH='packages/verified-issuer-runtime/linux/clockbound-precise-origin.patch'
READER='docs/recovery/2026-11-13/real-governance-qualification/design/linux-artifact-integration/archive-read/reader.py'
def digest(value):return hashlib.sha256(value).hexdigest()
OLD={'clock-bound/src/a.rs':b'one\ntwo\nthree\n'}
DIFF=b'--- a/clock-bound/src/a.rs\n+++ b/clock-bound/src/a.rs\n@@ -1,3 +1,3 @@\n one\n-two\n+changed\n three\n'
NEW=b'one\nchanged\nthree\n'
class PatchTests(unittest.TestCase):
 def test_actual_hunks_apply_exactly_and_preserve_other_files(self):
  files={**OLD,'LICENSE':b'preserved'};original=dict(files)
  result=m.apply_exact_patch(files,DIFF,{'clock-bound/src/a.rs':digest(NEW)})
  self.assertEqual(result,{'clock-bound/src/a.rs':NEW,'LICENSE':b'preserved'});self.assertEqual(files,original)
 def reject(self,patch=DIFF,expected=None):
  with self.assertRaises(ValueError):m.apply_exact_patch(OLD,patch,expected if expected is not None else {'clock-bound/src/a.rs':digest(NEW)})
 def test_mismatched_original_context_refuses(self):self.reject(DIFF.replace(b' one',b' other'))
 def test_wrong_hunk_counts_refuse(self):self.reject(DIFF.replace(b'-1,3',b'-1,2'))
 def test_wrong_new_offset_refuses(self):self.reject(DIFF.replace(b'+1,3',b'+2,3'))
 def test_wrong_output_hash_refuses(self):self.reject(expected={'clock-bound/src/a.rs':'0'*64})
 def test_unreviewed_file_path_refuses(self):self.reject(DIFF.replace(b'src/a.rs',b'src/../a.rs'))
 def test_duplicate_file_and_trailing_junk_refuse(self):
  self.reject(DIFF+DIFF);self.reject(DIFF+b'not a hunk\n')
 def test_unknown_or_missing_target_refuses(self):
  self.reject(expected={});self.reject(expected={'clock-bound/src/a.rs':digest(NEW),'extra':'0'*64})
 def test_no_newline_marker_and_crlf_refuse(self):
  self.reject(DIFF+b'\\ No newline at end of file\n');self.reject(DIFF.replace(b'\n',b'\r\n'))
class MaterializeTests(unittest.TestCase):
 def setUp(self):self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.base=Path(self.tmp.name)
 def copy_repo(self):
  repo=self.base/'repo';repo.mkdir();paths=[PATCH,READER,'packages/verified-issuer-runtime/linux/time_publication_adapter.rs','packages/verified-issuer-runtime/linux/time_publication.c','packages/verified-issuer-runtime/linux/time_publication.h',VENDOR+'/EXPECTED-PATCHED-SHA256.json',VENDOR+'/UPSTREAM-TREE.json',VENDOR+'/clock-bound-371058f8-source.tar.gz']
  for name in paths:
   target=repo/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/name,target)
  return repo
 def test_real_verified_archive_current_patch_and_exact_module_materialize_without_execution(self):
  with patch('subprocess.Popen',side_effect=AssertionError('no child process')),patch('http.client.HTTPSConnection',side_effect=AssertionError('no network')):
   result=m.materialize(ROOT,self.base/'prepared')
  source=Path(result['sourceRoot'])
  self.assertEqual(result['lockBytes'],(source/'Cargo.lock').read_bytes());self.assertEqual(digest(result['receipt']),result['receiptSha256'])
  receipt=json.loads(result['receipt']);self.assertEqual(receipt['upstreamFiles'],322);self.assertEqual(receipt['patchedFiles'],19);self.assertEqual(receipt['materializedFiles'],323)
  expected=json.loads((ROOT/VENDOR/'EXPECTED-PATCHED-SHA256.json').read_bytes())['patchedSha256']
  for name,value in expected.items():self.assertEqual(digest((source/name).read_bytes()),value)
  self.assertEqual((source/'clock-bound/src/daemon/time_publication_adapter.rs').read_bytes(),(ROOT/'packages/verified-issuer-runtime/linux/time_publication_adapter.rs').read_bytes())
  for current,dirs,files in os.walk(source):
   self.assertEqual(stat.S_IMODE(Path(current).stat().st_mode),0o700)
   for name in files:self.assertEqual(stat.S_IMODE((Path(current)/name).stat().st_mode),0o600)
 def test_native_c_and_header_are_frozen_owned_copies_not_later_repository_reads(self):
  result=m.materialize(ROOT,self.base/'prepared');native=(self.base/'prepared'/'native').resolve()
  for key,name in [('nativeC','time_publication.c'),('nativeHeader','time_publication.h')]:
   self.assertEqual(result[key],native/name);self.assertEqual(result[key].read_bytes(),(ROOT/'packages/verified-issuer-runtime/linux'/name).read_bytes());self.assertEqual(stat.S_IMODE(result[key].stat().st_mode),0o600)
 def test_existing_destination_is_never_overwritten(self):
  destination=self.base/'existing';destination.mkdir();(destination/'keep').write_bytes(b'original')
  with self.assertRaises(ValueError):m.materialize(ROOT,destination)
  self.assertEqual((destination/'keep').read_bytes(),b'original')
 def test_modified_pinned_inputs_refuse_before_creating_destination(self):
  repo=self.copy_repo()
  for index,name in enumerate([PATCH,READER,VENDOR+'/UPSTREAM-TREE.json','packages/verified-issuer-runtime/linux/time_publication_adapter.rs',VENDOR+'/EXPECTED-PATCHED-SHA256.json',VENDOR+'/clock-bound-371058f8-source.tar.gz']):
   path=repo/name;old=path.read_bytes();path.write_bytes(old+b'altered');destination=self.base/('bad-'+str(index))
   with self.subTest(name=name):
    with self.assertRaises(ValueError):m.materialize(repo,destination)
    self.assertFalse(destination.exists())
   path.write_bytes(old)
 def test_symlink_input_and_symlink_destination_refuse(self):
  repo=self.copy_repo();path=repo/PATCH;path.unlink();path.symlink_to(ROOT/PATCH)
  with self.assertRaises(ValueError):m.materialize(repo,self.base/'out')
  target=self.base/'target';target.mkdir();destination=self.base/'link';destination.symlink_to(target,target_is_directory=True)
  with self.assertRaises(ValueError):m.materialize(ROOT,destination)
  self.assertEqual(list(target.iterdir()),[])
if __name__=='__main__':unittest.main()
