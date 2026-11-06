"""Synthetic signed-layout bytes only, not cryptographic or native acceptance."""
import sys,struct,hashlib,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parents[2]))
from governance_local_issuer import saved_profile_observation as p
ID='com.visionxixlabs.axiom.synthetic-query';TEAM='FG5N98FE6W'
def image(pages=1045,kind=6):
 ident=ID.encode()+b'\0';team=TEAM.encode()+b'\0';start=pages*16384
 req=struct.pack('>III',0xfade0c01,12,0);cms=struct.pack('>II',0xfade0b01,8)
 hstart=96+len(ident)+len(team)+64;cdlen=hstart+pages*32
 cd=bytearray(cdlen);struct.pack_into('>9I4BI',cd,0,0xfade0c02,cdlen,0x20500,0x10000,hstart,96,2,pages,start,32,2,0,14,0)
 struct.pack_into('>IIIQ',cd,44,0,96+len(ident),0,0);struct.pack_into('>QQQII',cd,64,0,start,0,0x1a0500,0)
 cd[96:96+len(ident)]=ident;cd[96+len(ident):96+len(ident)+len(team)]=team;cd[hstart-64:hstart-32]=hashlib.sha256(req).digest()
 total=36+len(cd)+len(req)+len(cms);body=bytearray(start)
 struct.pack_into('<8I',body,0,0xfeedfacf,0x100000c,0,kind,1,16,0,0);struct.pack_into('<4I',body,32,0x1d,16,start,total)
 for i in range(pages):cd[hstart+i*32:hstart+(i+1)*32]=hashlib.sha256(body[i*16384:(i+1)*16384]).digest()
 outer=struct.pack('>III',0xfade0cc0,total,3)+struct.pack('>6I',0,36,2,36+len(cd),65536,36+len(cd)+len(req))
 return bytes(body+outer+cd+req+cms)
class Tests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.data=image()
 def test_1045_page_dylib_absence_observed(self):
  r=p.inspect_library_no_entitlements(self.data,ID,TEAM);self.assertEqual(r['machOFileType'],6);self.assertFalse(r['executionAuthorized'])
 def test_wrong_kind_and_identity_refuse(self):
  for data,ident,team in [(image(kind=8),ID,TEAM),(self.data,'other',TEAM),(self.data,ID,'other')]:
   with self.assertRaises(ValueError):p.inspect_library_no_entitlements(data,ident,team)
 def test_guard_outer_bound_and_kind_stay_unchanged(self):
  with self.assertRaises(ValueError):p.inspect_guard_no_entitlements(image(kind=8),ID,TEAM)
  with self.assertRaises(ValueError):p.inspect_guard_no_entitlements(image(pages=1),ID,TEAM)
 def test_entitlement_slot_code_page_and_signature_tampering_refuse(self):
  start=1045*16384
  for offset,value in [(100,b'X'),(start+28,struct.pack('>I',5)),(start+36+12,struct.pack('>I',0)),(start+36+96,b'X')]:
   b=bytearray(self.data);b[offset:offset+len(value)]=value
   with self.assertRaises(ValueError):p.inspect_library_no_entitlements(bytes(b),ID,TEAM)
 def test_truncation_and_oversize_refuse(self):
  for data in (self.data[:-1],b'X'*(32*1024*1024+1)):
   with self.assertRaises(ValueError):p.inspect_library_no_entitlements(data,ID,TEAM)
class ResidualTests(unittest.TestCase):
 def test_only_exact_original_residue_relation_is_observed(self):
  b=bytearray(image(pages=1));oldlen=struct.unpack_from('<I',b,44)[0];residue=b'PRESERVED OPAQUE BYTES'
  struct.pack_into('<I',b,44,oldlen+len(residue))
  # Changing LC_CODE_SIGNATURE length changes its covered first code page.
  start=16384;cdstart=start+36;hashoff=struct.unpack_from('>I',b,cdstart+16)[0]
  b[cdstart+hashoff:cdstart+hashoff+32]=hashlib.sha256(b[:start]).digest();b.extend(residue);data=bytes(b)
  r=p.inspect_library_no_entitlements(data,ID,TEAM,original=data)
  self.assertEqual(r['preservedResidualBytes'],len(residue))
  for original in (None,data[:-1]+b'X'):
   with self.assertRaises(ValueError):p.inspect_library_no_entitlements(data,ID,TEAM,original=original)
  with self.assertRaises(ValueError):p.inspect_guard_no_entitlements(data,ID,TEAM)
if __name__=='__main__':unittest.main()
