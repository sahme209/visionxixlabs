"""Synthetic byte comparison only; no code signing/native loading."""
import struct,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parents[2]))
from governance_local_issuer import query_derivative as q

def image(tail=32):
 b=bytearray(4096+tail)
 struct.pack_into('<8I',b,0,0xfeedfacf,0x100000c,0,6,3,160,0,0)
 struct.pack_into('<II16sQQQQIIII',b,32,0x19,72,b'__TEXT',0,4096,0,2048,5,5,0,0)
 struct.pack_into('<II16sQQQQIIII',b,104,0x19,72,b'__LINKEDIT',4096,16384,2048,2048+tail,1,1,0,0)
 struct.pack_into('<4I',b,176,0x1d,16,4096,tail)
 b[300:304]=b'CODE';b[4096:]=b'S'*tail
 return bytes(b)
class Tests(unittest.TestCase):
 def test_signature_only(self):
  r=q.validate_derivative(image(),image(64));self.assertEqual(r['signatureOffset'],4096)
 def test_code_change(self):
  b=bytearray(image(64));b[300]^=1
  with self.assertRaises(ValueError):q.validate_derivative(image(),bytes(b))
 def test_load_configuration_change(self):
  b=bytearray(image(64));struct.pack_into('<I',b,92,7)
  with self.assertRaises(ValueError):q.validate_derivative(image(),bytes(b))
 def test_signature_offset_change(self):
  b=bytearray(image(64));struct.pack_into('<I',b,184,4080)
  with self.assertRaises(ValueError):q.validate_derivative(image(),bytes(b))
 def test_overlap(self):
  b=bytearray(image());struct.pack_into('<Q',b,144,1024)
  with self.assertRaises(ValueError):q.validate_derivative(bytes(b),image(64))
 def test_truncated_or_wrong_type(self):
  for b in (b'bad',image()[:180]):
   with self.assertRaises(ValueError):q.validate_derivative(b,image(64))
  b=bytearray(image());struct.pack_into('<I',b,12,2)
  with self.assertRaises(ValueError):q.validate_derivative(bytes(b),image(64))
class AdditionalTests(unittest.TestCase):
 def test_unknown_command_on_both_sides_is_refused(self):
  def altered(n):
   b=bytearray(image(n));struct.pack_into('<II',b,16,4,176);struct.pack_into('<IIQ',b,192,0x777,16,0);return bytes(b)
  with self.assertRaises(ValueError):q.validate_derivative(altered(32),altered(64))
if __name__=='__main__':unittest.main()
