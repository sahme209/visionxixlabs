"""Synthetic thin-arm64 and signature structures; no code/signing/tool execution."""
from pathlib import Path
import hashlib,json,plistlib,struct,sys,unittest,tempfile
sys.path.insert(0,str(Path(__file__).parents[2]))
from governance_local_issuer import fixture_final_seal as s,container_preparation as cp
CS=16560
def original():
 data=bytearray(CS+32);struct.pack_into('<8I',data,0,0xfeedfacf,0x100000c,0,2,3,160,0x200085,0)
 for at,name,vm,vs,fo,fs in [(32,b'__TEXT',0,16384,0,16384),(104,b'__LINKEDIT',16384,16384,16384,len(data)-16384)]:struct.pack_into('<II16sQQQQIIII',data,at,0x19,72,name.ljust(16,b'\0'),vm,vs,fo,fs,5,5,0,0)
 struct.pack_into('<4I',data,176,0x1d,16,CS,32);return bytes(data)
def signed(before,encoded=False):
 ident=cp.MAIN_IDENTIFIER.encode()+b'\0';team=b'FG5N98FE6W\0';special=7 if encoded else 3;count=(CS+16383)//16384;offset=96+len(ident)+len(team)+special*32;cd=bytearray(offset+count*32)
 struct.pack_into('>9I4BI',cd,0,0xfade0c02,len(cd),0x20500,0x10000,offset,96,special,count,CS,32,2,0,14,0);struct.pack_into('>IIIQ',cd,44,0,96+len(ident),0,0);struct.pack_into('>QQQII',cd,64,0,16384,1,1705216,0);cd[96:96+len(ident)]=ident;cd[96+len(ident):96+len(ident)+len(team)]=team
 blobs={0:bytes(cd),2:struct.pack('>II',0xfade0c01,8),65536:struct.pack('>II',0xfade0b01,8)}
 if encoded:
  xml=plistlib.dumps({});blobs[5]=struct.pack('>II',0xfade7171,len(xml)+8)+xml;blobs[7]=struct.pack('>II',0xfade7172,15)+bytes.fromhex('7005020101b000')
 total=12+8*len(blobs)+sum(map(len,blobs.values()));tail=bytearray(struct.pack('>III',0xfade0cc0,total,len(blobs)));at=12+8*len(blobs)
 for slot,blob in sorted(blobs.items()):tail+=struct.pack('>II',slot,at);at+=len(blob)
 for slot,blob in sorted(blobs.items()):tail+=blob
 result=bytearray(before[:CS])+tail;struct.pack_into('<Q',result,136,((len(result)-16384+16383)//16384)*16384);struct.pack_into('<Q',result,152,len(result)-16384);struct.pack_into('<I',result,188,len(tail));return bytes(result)
class FixtureSealParserTests(unittest.TestCase):
 def test_positive_derived_load_command_offsets_and_both_empty_profiles(self):
  for encoded in (False,True):
   r=s.validate_fixture_main_change(original(),signed(original(),encoded));self.assertEqual(r['identifier'],cp.MAIN_IDENTIFIER);self.assertFalse(r['cryptographicSignatureVerifiedHere'])
 def test_non_signature_prefix_and_unjustified_numeric_field_refuse(self):
  for at in (0,16,128,144,184,1024):
   after=bytearray(signed(original()));after[at]^=1
   with self.subTest(offset=at),self.assertRaises(ValueError):s.validate_fixture_main_change(original(),bytes(after))
 def test_duplicate_bad_extent_or_non_arm64_before_refuses(self):
  for at,value in [(4,7),(8,2),(80,1),(20,159),(176,0x19),(180,8),(184,100)]:
   before=bytearray(original());struct.pack_into('<I',before,at,value)
   with self.subTest(offset=at),self.assertRaises(ValueError):s.validate_fixture_main_change(bytes(before),signed(original()))
 def test_layout_rejects_text_ending_inside_commands_and_unselected_subtype(self):
  for at,value in [(80,1),(8,2)]:
   before=bytearray(original());struct.pack_into('<I',before,at,value)
   with self.subTest(offset=at),self.assertRaises(ValueError):s._layout(bytes(before))
 def test_oversized_main_is_rejected_by_bounded_file_reader(self):
  with tempfile.TemporaryDirectory(dir='/private/tmp')as root:
   target=Path(root)/'oversized';target.write_bytes(b'x'*(2*1024*1024+1));target.chmod(0o600)
   with self.assertRaises(ValueError):s._main_bytes(target)
 def test_tail_or_wrong_team_or_new_entitlement_refuses(self):
  after=signed(original())
  for data in (after+b'rogue',after.replace(b'FG5N98FE6W',b'WRONG_TEAM')):
   with self.assertRaises(ValueError):s.validate_fixture_main_change(original(),data)
if __name__=='__main__':unittest.main()

class FixtureSealFlowTests(unittest.TestCase):
 def setUp(self):
  from governance_local_issuer.tests.test_fixture_container import FixtureContainerTests
  self.case=FixtureContainerTests();self.case.setUp();self.addCleanup(self.case.doCleanups);self.f=self.case.f
  self.f.main.write_bytes(original());self.case.base['main']=s.old.binding(self.f.main)
  self.pre=s.assembly.assemble_fixture_container_inputs(self.case.packet,self.case.destination);self.destination=self.case.destination;self.app=self.destination/'Axiom Synthetic Custodian.app';self.out=self.f.root/'seal-flow';self.out.mkdir(mode=0o700)
  self.baseline=s.capture_fixture_seal_baseline(self.destination,self.out)
 def seal(self):
  before=(self.app/s.MAIN).read_bytes();after=signed(before);(self.app/s.MAIN).write_bytes(after);profile=s.validate_fixture_main_change(before,after)
  resource=self.app/'Contents/_CodeSignature/CodeResources';resource.parent.mkdir(mode=0o700);resource.write_bytes(plistlib.dumps({'files2':{}}));resource.chmod(0o600);records={}
  for kind,argv in s.fixture_seal_commands(self.baseline).items():
   out=b'';err=(f"Identifier={cp.MAIN_IDENTIFIER}\nTeamIdentifier=FG5N98FE6W\nCodeDirectory v=20500 flags=0x10000(runtime)\nCDHash={profile['cdhash']}\n".encode())if kind=='display'else b''
   stdout=self.f.put(self.out/(kind+'-stdout'),out);stderr=self.f.put(self.out/(kind+'-stderr'),err)
   record={'format':'axiom.fixture-seal-command/1','kind':kind,'argv':argv,'state':'completed','exit':0,'cleanup':'reaped_original_child','errorType':None,'baselineSha256':self.baseline['sha256'],'targetAfter':s.old.binding(self.app/s.MAIN),'stdout':s.old.binding(stdout),'stderr':s.old.binding(stderr)}
   records[kind]=s.old.binding(self.f.js(self.out/(kind+'-record.json'),record))
  return records
 def test_complete_synthetic_capture_tool_join_and_postseal(self):
  r=s.validate_fixture_postseal(self.baseline,self.seal(),self.out);self.assertTrue(r['allowedMutationScopeVerified']);self.assertFalse(r['cryptographicVerificationPerformedHere']);self.assertFalse(r['executionAuthorized'])
 def test_main_file_replacement_preserving_allowed_signature_scope_is_accepted(self):
  records=self.seal();target=self.app/s.MAIN;replacement=self.out/'replacement-main';replacement.write_bytes(target.read_bytes());replacement.chmod(target.stat().st_mode&0o777);replacement.replace(target)
  self.assertTrue(s.validate_fixture_postseal(self.baseline,records,self.out)['allowedMutationScopeVerified'])
 def test_successful_tool_record_with_wrong_baseline_is_refused(self):
  records=self.seal();record=json.loads(Path(records['verify']['path']).read_text());record['baselineSha256']='f'*64;path=self.f.js(self.out/'wrong-verify-baseline.json',record);records['verify']=s.old.binding(path)
  with self.assertRaisesRegex(ValueError,'fixture_tool_baseline_target_join_required'):s.validate_fixture_postseal(self.baseline,records,self.out)
 def test_external_node_or_new_resource_never_adopted(self):
  records=self.seal();(self.destination/'fixture-tools/node').write_bytes(b'OTHER NODE')
  with self.assertRaisesRegex(ValueError,'fixture_authoritative_resource_or_external_node_changed'):s.validate_fixture_postseal(self.baseline,records,self.out)
 def test_forged_baseline_source_hash_and_extra_output_refuse(self):
  records=self.seal();baseline=json.loads(Path(self.baseline['path']).read_text());baseline['files']['fixture-tools/node']['sha256']='f'*64;forged=self.f.js(self.out/'forged-baseline.json',baseline)
  with self.assertRaisesRegex(ValueError,'fixture_seal_baseline_source_mismatch'):s.validate_fixture_postseal(s.old.binding(forged),records,self.out)
