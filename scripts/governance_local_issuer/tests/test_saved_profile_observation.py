from pathlib import Path
import sys,unittest,struct,hashlib,json,tempfile,stat
sys.path.insert(0,str(Path(__file__).parents[2]))
from governance_local_issuer.saved_profile_observation import inspect_guard_no_entitlements,inspect_empty_dictionary,ObservationUnavailable,reconcile_saved_batch
ID='com.visionxixlabs.axiom.synthetic.guard';TEAM='FG5N98FE6W'
def fixture():
 ident=ID.encode()+b'\0';team=TEAM.encode()+b'\0';start=16384
 req=struct.pack('>III',0xfade0c01,12,0);cms=struct.pack('>II',0xfade0b01,8)
 hstart=96+len(ident)+len(team)+64;cdlen=hstart+32
 cd=bytearray(cdlen);struct.pack_into('>9I4BI',cd,0,0xfade0c02,cdlen,0x20500,0x10000,hstart,96,2,1,start,32,2,0,14,0)
 struct.pack_into('>IIIQ',cd,44,0,96+len(ident),0,0);struct.pack_into('>QQQII',cd,64,0,start,0,0x1a0500,0)
 cd[96:96+len(ident)]=ident;cd[96+len(ident):96+len(ident)+len(team)]=team
 cd[hstart-64:hstart-32]=hashlib.sha256(req).digest()
 total=36+len(cd)+len(req)+len(cms)
 body=bytearray(start);struct.pack_into('<8I',body,0,0xfeedfacf,0x100000c,0,8,1,16,0,0);struct.pack_into('<4I',body,32,0x1d,16,start,total)
 cd[hstart:hstart+32]=hashlib.sha256(body).digest()
 outer=struct.pack('>III',0xfade0cc0,total,3)+struct.pack('>6I',0,36,2,36+len(cd),65536,36+len(cd)+len(req))
 return bytes(body+outer+cd+req+cms)
class SavedProfileTests(unittest.TestCase):
 def test_absent_guard_payload_is_distinct_observation_not_dictionary(self):
  result=inspect_guard_no_entitlements(fixture(),ID,TEAM)
  self.assertEqual(result['representation'],'no_encoded_entitlement_payload_observed');self.assertFalse(result['executionAuthorized'])
 def test_explicit_empty_dictionary(self):
  self.assertEqual(inspect_empty_dictionary(b'<?xml version="1.0"?><plist version="1.0"><dict/></plist>')['representation'],'explicit_empty_dictionary_observed')
 def test_empty_or_nonempty_dictionary_refuses(self):
  for b in [b'',b'not a plist',b'<?xml version="1.0"?><plist version="1.0"><dict><key>exception</key><true/></dict></plist>']:
   with self.subTest(b=b):self.assertRaises(ObservationUnavailable,inspect_empty_dictionary,b)
 def test_truncations_and_extra_nonzero_bytes_refuse(self):
  data=fixture()
  for b in [data[:4],data[:-1],data+b'x']:
   with self.subTest(length=len(b)):self.assertRaises(ObservationUnavailable,inspect_guard_no_entitlements,b,ID,TEAM)
 def test_wrong_kind_profile_identity_or_page_refuses(self):
  original=fixture()
  for offset,raw in [(12,struct.pack('<I',2)),(16384+36+12,struct.pack('>I',0)),(16384+36+96,b'X'),(100,b'X')]:
   b=bytearray(original);b[offset:offset+len(raw)]=raw
   with self.subTest(offset=offset):self.assertRaises(ObservationUnavailable,inspect_guard_no_entitlements,bytes(b),ID,TEAM)
 def test_duplicate_overlapping_unknown_or_entitlement_slots_refuse(self):
  original=fixture()
  for offset,value in [(16384+12+8,0),(16384+12+12,36),(16384+12+16,5),(16384+12+16,7),(16384+12+16,99)]:
   b=bytearray(original);struct.pack_into('>I',b,offset,value)
   with self.subTest(offset=offset,value=value):self.assertRaises(ObservationUnavailable,inspect_guard_no_entitlements,bytes(b),ID,TEAM)
class SavedBatchTests(unittest.TestCase):
 def setUp(self):
  self.t=tempfile.TemporaryDirectory(prefix='axiom-saved-profile-');self.addCleanup(self.t.cleanup);self.root=Path(self.t.name).resolve();self.batch=self.root/'batch';self.batch.mkdir(mode=0o700);self.obs=self.root/'observation';self.obs.mkdir();self.empty=b'<?xml version="1.0"?><plist version="1.0"><dict/></plist>'
  def binding(p):
   st=p.stat();return {'path':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'size':st.st_size,'uid':st.st_uid,'mode':oct(stat.S_IMODE(st.st_mode)),'dev':st.st_dev,'ino':st.st_ino,'mtime_ns':st.st_mtime_ns,'ctime_ns':st.st_ctime_ns}
  self.ent=self.batch/'empty.plist';self.ent.write_bytes(self.empty);self.ent.chmod(0o600);leaves=[]
  for role in ['owner','maintenance','bootstrap','guard']:
   original=self.root/(role+'-original');original.write_bytes(b'original '+role.encode());original.chmod(0o600)
   target=self.batch/role;target.write_bytes(fixture() if role=='guard' else b'signed '+role.encode());target.chmod(0o600);ident=ID if role=='guard' else 'com.example.'+role
   commands=[['sign',str(target)],['verify',str(target)],['display',str(target)]];leaf={'role':role,'identifier':ident,'sourceArtifact':binding(original),'target':binding(target),'commands':commands};leaves.append(leaf)
   d=self.obs/role;d.mkdir();logs=[]
   for i,argv in enumerate(commands,1):
    stdout=self.empty if i==3 and role!='guard' else b'';stderr=(f'Identifier={ident}\nTeamIdentifier={TEAM}\nFormat=Mach-O thin (arm64)\nCodeDirectory v=20500 flags=0x10000(runtime)\nInfo.plist=not bound\nSealed Resources=none\nCDHash='+hashlib.sha256(fixture()).hexdigest()+'\n').encode() if i==3 else b''
    if i==3 and role=='guard':
     cd=inspect_guard_no_entitlements(fixture(),ID,TEAM)['cdhash'];stderr=stderr.replace(hashlib.sha256(fixture()).hexdigest().encode(),cd.encode())
    (d/f'{i}-stdout.log').write_bytes(stdout);(d/f'{i}-stderr.log').write_bytes(stderr);logs.append({'argv':argv,'exit':0,'state':'completed','elapsed_seconds':.1,'stdout_bytes':len(stdout),'stderr_bytes':len(stderr)})
   (d/'commands.json').write_text(json.dumps(logs));record={'artifact_after':binding(target)}
   (d/('saved-byte-inspection.json' if role=='guard' else 'result.json')).write_text(json.dumps(record))
  self.packet=self.root/'packet.json';self.packet.write_text(json.dumps({'batch':str(self.batch),'entitlements':binding(self.ent),'leaves':leaves}));(self.obs/'approval-claimed.json').write_text(json.dumps({'consumed':True,'packetSha256':hashlib.sha256(self.packet.read_bytes()).hexdigest()}));self.prior=self.obs/'result.json';self.prior.write_text(json.dumps({'allFourStaticSequencesAccepted':False,'guardEntitlementDictionaryProfileUnconfirmed':True}))
 def test_new_supplement_observes_both_forms_without_rewriting_failure(self):
  old=self.prior.read_bytes();result=reconcile_saved_batch(self.packet,self.obs)
  self.assertTrue(result['allFourRepresentationsObserved']);self.assertFalse(result['executionAuthorized']);self.assertFalse(result['historicalBatchAccepted']);self.assertEqual(self.prior.read_bytes(),old)
 def test_changed_target_original_or_extra_file_refuses(self):
  (self.batch/'guard').write_bytes(b'changed');self.assertRaises(ObservationUnavailable,reconcile_saved_batch,self.packet,self.obs)
 def test_nonzero_or_changed_argv_refuses(self):
  p=self.obs/'owner/commands.json';v=json.loads(p.read_text());v[0]['exit']=1;p.write_text(json.dumps(v));self.assertRaises(ObservationUnavailable,reconcile_saved_batch,self.packet,self.obs)
 def test_empty_display_without_signed_guard_structure_refuses(self):
  p=self.obs/'guard/3-stderr.log';p.write_bytes(b'');self.assertRaises(ObservationUnavailable,reconcile_saved_batch,self.packet,self.obs)
 def test_changed_original_refuses(self):
  (self.root/'owner-original').write_bytes(b'changed original');self.assertRaises(ObservationUnavailable,reconcile_saved_batch,self.packet,self.obs)
 def test_extra_batch_file_refuses(self):
  (self.batch/'unexpected-seal').write_bytes(b'added');self.assertRaises(ObservationUnavailable,reconcile_saved_batch,self.packet,self.obs)
 def test_changed_argv_refuses_even_with_zero_exit(self):
  p=self.obs/'owner/commands.json';v=json.loads(p.read_text());v[0]['argv']=['different'];p.write_text(json.dumps(v));self.assertRaises(ObservationUnavailable,reconcile_saved_batch,self.packet,self.obs)
 def test_mismatched_guard_cdhash_refuses_after_consistent_log_counts(self):
  p=self.obs/'guard/3-stderr.log';b=p.read_bytes();start=b.index(b'CDHash=')+7;b=b[:start]+b'0'*40+b[start+40:];p.write_bytes(b);self.assertRaises(ObservationUnavailable,reconcile_saved_batch,self.packet,self.obs)
if __name__=='__main__':unittest.main()
