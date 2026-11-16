"""Pure retained-log diagnostics; no Windows/native/build execution."""
import hashlib,importlib.util,tempfile,unittest
from pathlib import Path
SOURCE=Path(__file__).resolve().parents[1]/'windows_installed_acceptance.py'
spec=importlib.util.spec_from_file_location('tail_owner',SOURCE);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class DiagnosticTail(unittest.TestCase):
 def test_actual_error_at_end_survives_when_original_prefix_loses_it(self):
  with tempfile.TemporaryDirectory() as folder:
   p=Path(folder)/'stderr';p.write_bytes(b'compile progress\n'*500+b'FIXED_OWNED_BUILDER_ERROR_AT_END\n')
   result=m.bounded_stream_diagnostics(p)
   self.assertNotIn('FIXED_OWNED_BUILDER_ERROR_AT_END',result['text'])
   self.assertIn('FIXED_OWNED_BUILDER_ERROR_AT_END',result['tailText'])
   self.assertEqual(result['text'],p.read_bytes()[:2048].decode());self.assertEqual(result['sha256'],hashlib.sha256(p.read_bytes()).hexdigest())
   self.assertTrue(result['prefixTruncated']);self.assertLessEqual(result['tailBytes'],4096);self.assertEqual(result['tailOffsetBytes']+result['tailBytes'],p.stat().st_size);self.assertGreaterEqual(result['tailOffsetBytes'],2048)
 def test_utf8_and_control_cleanup_match_existing_prefix_without_unbounded_read(self):
  with tempfile.TemporaryDirectory() as folder:
   p=Path(folder)/'stderr';p.write_bytes(('€'*1600).encode()+b'\x00\x1b\x01 fixed_error\n')
   result=m.bounded_stream_diagnostics(p)
   self.assertIn('fixed_error',result['tailText']);self.assertNotIn('\x00',result['tailText']);self.assertNotIn('\x1b',result['tailText']);self.assertNotIn('\x01',result['tailText']);self.assertLessEqual(len(result['tailText']),4096)
 def test_small_stream_is_not_duplicated_and_existing_fields_remain_exact(self):
  with tempfile.TemporaryDirectory() as folder:
   p=Path(folder)/'stdout';p.write_bytes(b'complete small stream\n')
   result=m.bounded_stream_diagnostics(p)
   self.assertEqual(set(result),{'sha256','bytes','text','prefixTruncated'});self.assertFalse(result['prefixTruncated']);self.assertEqual(result['text'],'complete small stream\n')
   p.write_bytes(b'x'*2048+b'end');result=m.bounded_stream_diagnostics(p);self.assertEqual(result['tailText'],'end');self.assertEqual(result['tailBytes'],3)
if __name__=='__main__':unittest.main()
