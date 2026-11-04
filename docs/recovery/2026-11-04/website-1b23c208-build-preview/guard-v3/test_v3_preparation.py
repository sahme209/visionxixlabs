import importlib.util,json,unittest
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).parent
spec=importlib.util.spec_from_file_location('v3_launcher',ROOT/'launch_preview.py');launcher=importlib.util.module_from_spec(spec);spec.loader.exec_module(launcher)
binding=json.loads((ROOT/'launch-binding.json').read_bytes())
class V3Preparation(unittest.TestCase):
 def test_exact_fixed_launcher_inputs_and_cache_without_launch(self):
  with patch.object(launcher.os,'execve') as execute:
   checked=launcher.verify_prepared_inputs()
   self.assertEqual(checked['cacheDirectory'],binding['cacheDirectory']);execute.assert_not_called()
  self.assertEqual(str(launcher.CACHE),'/private/tmp/axiom-website-1b23c208-eh6g339f/stage/.next/cache/images')
 def test_cache_identity_or_caller_path_mismatch_refuses(self):
  for field,value in [('inode',-1),('uid',-1),('mode',0o777),('path','/private/tmp/not-authorized-cache')]:
   altered=dict(binding['cacheDirectory']);altered[field]=value
   with self.assertRaises(RuntimeError):launcher.verify_cache_directory(altered)
 def test_symlink_or_nondirectory_cache_refuses(self):
  class Replaced:
   parents=[]
   def lstat(self):return launcher.CACHE.lstat()
   def is_symlink(self):return True
  actual=launcher.CACHE
  class Symlink:
   parents=[]
   def lstat(self):return actual.lstat()
   def is_symlink(self):return True
  with patch.object(launcher,'CACHE',Symlink()):
   with self.assertRaises(RuntimeError):launcher.verify_cache_directory(binding['cacheDirectory'])
 def test_only_exact_cache_write_exception_backend_no_outbound(self):
  backend=(ROOT/'backend.sb').read_text();proxy=(ROOT/'proxy.sb').read_text()
  self.assertIn('(deny file-write*)',backend)
  self.assertEqual([line for line in backend.splitlines() if line.startswith('(allow file-write')],['(allow file-write* (subpath "/private/tmp/axiom-website-1b23c208-eh6g339f/stage/.next/cache/images"))'])
  self.assertNotIn('(allow network-outbound',backend);self.assertIn('(deny network-outbound)',backend)
  self.assertIn('(deny file-write*)',proxy);self.assertNotIn('(allow file-write',proxy)
  self.assertIn('(remote ip "localhost:5225")',proxy)
if __name__=='__main__':unittest.main(verbosity=2)
