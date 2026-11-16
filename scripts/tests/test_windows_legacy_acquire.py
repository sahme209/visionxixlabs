"""Pure bounded acquisition tests with in-memory response, no network."""
import importlib.util,sys,tempfile,unittest,hashlib,io
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).parents[1]))
import windows_legacy_acquire as acquire
class Acquisition(unittest.TestCase):
 def test_exact_hash_size_acquisition_writes_only_complete_fixed_assets(self):
  payload=b'synthetic public fixture';item={'name':'fixed.exe','bytes':len(payload),'sha256':hashlib.sha256(payload).hexdigest()}
  class Opener:
   def open(self,url,timeout):
    self_url=url
    if not self_url.startswith('https://github.com/sahme209/axiom-releases/releases/download/desktop-v0.1.21/'):raise AssertionError('unfixed URL')
    return io.BytesIO(payload)
  with tempfile.TemporaryDirectory() as folder,patch.object(acquire,'LEGACY_ASSETS',{'nsis':item}),patch.object(acquire.urllib.request,'build_opener',return_value=Opener()),patch.object(sys,'argv',['fixed',str(Path(folder)/'owned')]):
   acquire.main();self.assertEqual((Path(folder)/'owned/fixed.exe').read_bytes(),payload);self.assertFalse((Path(folder)/'owned/nsis.part').exists())
 def test_oversized_or_wrong_hash_never_promotes_partial_file(self):
  class Opener:
   def open(self,*args,**kw):return io.BytesIO(b'wrong fixture')
  for size,digest in [(1,'0'*64),(13,'0'*64)]:
   with tempfile.TemporaryDirectory() as folder,patch.object(acquire,'LEGACY_ASSETS',{'nsis':{'name':'fixed.exe','bytes':size,'sha256':digest}}),patch.object(acquire.urllib.request,'build_opener',return_value=Opener()),patch.object(sys,'argv',['fixed',str(Path(folder)/'owned')]):
    with self.assertRaises(RuntimeError):acquire.main()
    self.assertEqual(list((Path(folder)/'owned').iterdir()),[])
 def test_redirect_rejects_http_foreign_host_and_embedded_credentials(self):
  handler=acquire.FixedRedirect()
  for url in ['http://github.com/fixture','https://foreign.invalid/fixture','https://name:password@github.com/fixture']:
   with self.assertRaisesRegex(RuntimeError,'legacy_redirect_refused'):handler.redirect_request(None,None,302,'',{},url)
if __name__=='__main__':unittest.main()
