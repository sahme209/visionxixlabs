"""Actual small main is inert fixture data; all signatures/tools are synthetic."""
from pathlib import Path
import copy,hashlib,json,plistlib,struct,sys,unittest
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).parents[2]))
from governance_local_issuer import final_seal as s,container_assembly as a,manifest
import test_container_assembly as fixture

def signed_fixture(before,encoded=True):
 ident=s.cp.MAIN_IDENTIFIER.encode()+b'\0';team=b'FG5N98FE6W\0';special=7 if encoded else 3;count=2;offset=96+len(ident)+len(team)+special*32
 cd=bytearray(offset+count*32)
 struct.pack_into('>9I4BI',cd,0,0xfade0c02,len(cd),0x20500,0x10000,offset,96,special,count,s.CS_START,32,2,0,14,0)
 struct.pack_into('>IIIQ',cd,44,0,96+len(ident),0,0);struct.pack_into('>QQQII',cd,64,0,16384,1,1705216,0);cd[96:96+len(ident)]=ident;cd[96+len(ident):96+len(ident)+len(team)]=team
 blobs={0:bytes(cd),2:struct.pack('>II',0xfade0c01,8),65536:struct.pack('>II',0xfade0b01,8)}
 if encoded:
  xml=plistlib.dumps({});blobs[5]=struct.pack('>II',0xfade7171,8+len(xml))+xml;der=bytes.fromhex('7005020101b000');blobs[7]=struct.pack('>II',0xfade7172,8+len(der))+der
 total=12+8*len(blobs)+sum(map(len,blobs.values()));tail=bytearray(struct.pack('>III',0xfade0cc0,total,len(blobs)));at=12+8*len(blobs)
 for slot,blob in sorted(blobs.items()):tail+=struct.pack('>II',slot,at);at+=len(blob)
 for slot,blob in sorted(blobs.items()):tail+=blob
 out=bytearray(before[:s.CS_START])+tail;struct.pack_into('<Q',out,384,len(out)-16384);struct.pack_into('<Q',out,368,((len(out)-16384+16383)//16384)*16384);struct.pack_into('<I',out,772,len(tail));return bytes(out),hashlib.sha256(bytes(cd)).hexdigest()[:40]

class FinalSealTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.real_main=(s.APP/s.MAIN).read_bytes();cls.empty=s.EMPTY.read_bytes()
 def setUp(self):
  self.f=fixture.ContainerAssemblyTests();self.f.setUp();self.addCleanup(self.f.doCleanups)
  self.f.main.write_bytes(self.real_main);c=json.loads(self.f.compile.read_text());c['artifact']=a.binding(self.f.main);self.f.js(self.f.compile,c);p=json.loads(self.f.packet.read_text());p['containerCompile']=a.binding(self.f.compile);self.f.js(self.f.packet,p);self.f.assemble()
  self.app=self.f.destination/'Axiom Synthetic Custodian.app';self.receipt=self.f.destination/a.RECEIPT
  self.stack=__import__('contextlib').ExitStack();self.addCleanup(self.stack.close)
  for name,value in (('APP',self.app),('PRESEAL',self.receipt),('PRESEAL_SHA',a.binding(self.receipt)['sha256']),('EMPTY',self.f.put(self.f.root/'empty.plist',self.empty))):self.stack.enter_context(patch.object(s,name,value))
  self.output=self.f.root/'seal-records';self.output.mkdir(mode=0o700)
 def baseline(self):self.base=s.capture_baseline(self.output);return self.base
 def seal(self,encoded=True):
  after,cdhash=signed_fixture(self.real_main,encoded);(self.app/s.MAIN).write_bytes(after)
  resource=self.app/'Contents/_CodeSignature/CodeResources';resource.parent.mkdir(mode=0o700);resource.write_bytes(plistlib.dumps({'files2':{}}));resource.chmod(0o600)
  records={}
  for kind,argv in s.commands().items():
   out=plistlib.dumps({})if kind=='display'and encoded else b'';err=(f'Identifier={s.cp.MAIN_IDENTIFIER}\nTeamIdentifier=FG5N98FE6W\nCodeDirectory v=20500 flags=0x10000(runtime)\nCDHash={cdhash}\n'.encode())if kind=='display'else b''
   stdout=self.f.put(self.output/(kind+'-stdout'),out);stderr=self.f.put(self.output/(kind+'-stderr'),err)
   record={'format':'axiom.final-seal-command/1','kind':kind,'argv':argv,'state':'completed','exit':0,'cleanup':'reaped_original_child','errorType':None,'baselineSha256':self.base['sha256'],'targetAfter':a.binding(self.app/s.MAIN),'stdout':a.binding(stdout),'stderr':a.binding(stderr)}
   path=self.f.js(self.output/(kind+'-command.json'),record);records[kind]=a.binding(path)
  return records
 def test_positive_actual_prefix_scope_and_poststate_join(self):
  before=self.receipt.read_bytes();base=self.baseline();records=self.seal();r=s.validate_postseal(base,records,self.output)
  self.assertEqual(self.receipt.read_bytes(),before);self.assertTrue(r['strictStaticVerificationObserved']);self.assertFalse(r['executionAuthorized']);self.assertFalse(r['runtimeIdentityQualified']);self.assertFalse(r['installationReady'])
 def test_existing_directory_group_metadata_cannot_change(self):
  from types import SimpleNamespace
  base=self.baseline();records=self.seal();original=Path.lstat;target=self.app/'Contents/MacOS'
  def changed(path,*args,**kwargs):
   value=original(path,*args,**kwargs)
   if path==target:
    fields=('st_dev','st_ino','st_mode','st_nlink','st_uid','st_gid','st_size','st_mtime_ns','st_ctime_ns');values={key:getattr(value,key)for key in fields};values['st_gid']+=1;return SimpleNamespace(**values)
   return value
  with patch.object(Path,'lstat',new=changed):
   with self.assertRaisesRegex(ValueError,'seal_directory_metadata_changed'):s.validate_postseal(base,records,self.output)
 def test_standard_safe_new_signature_modes_are_bounded(self):
  base=self.baseline();records=self.seal();resource=self.app/'Contents/_CodeSignature/CodeResources';resource.chmod(0o644);resource.parent.chmod(0o755)
  self.assertTrue(s.validate_postseal(base,records,self.output)['allowedMutationScopeVerified'])
 def test_known_main_absence_branch_requires_structural_absence(self):
  base=self.baseline();records=self.seal(False);r=s.validate_postseal(base,records,self.output);self.assertEqual(r['mainProfile']['entitlementsRepresentation'],'structurally_absent')
 def test_instruction_byte_change_is_not_signature_mutation(self):
  after,_=signed_fixture(self.real_main);bad=bytearray(after);bad[1024]^=1
  with self.assertRaisesRegex(ValueError,'main_non_signature_bytes_changed'):s.validate_main_change(self.real_main,bytes(bad))
 def test_only_three_numeric_fields_and_consistent_bounds_allowed(self):
  after,_=signed_fixture(self.real_main)
  for offset in (0,16,376,768):
   bad=bytearray(after);bad[offset]^=1
   with self.subTest(offset=offset),self.assertRaises(ValueError):s.validate_main_change(self.real_main,bytes(bad))
 def test_extra_tail_and_wrong_linkedit_extent_refuse(self):
  after,_=signed_fixture(self.real_main)
  for bad in (after+b'BAD',after[:384]+bytes(8)+after[392:]):
   with self.assertRaises(ValueError):s.validate_main_change(self.real_main,bad)
 def test_authoritative_leaf_metadata_or_bytes_never_adopted(self):
  base=self.baseline();records=self.seal();(self.app/'Contents/MacOS/AxiomIssuerBroker').write_bytes(b'CHANGED')
  with self.assertRaises(ValueError):s.validate_postseal(base,records,self.output)
 def test_wrong_display_or_failed_tool_never_qualifies(self):
  base=self.baseline();records=self.seal();record=json.loads(Path(records['verify']['path']).read_text());record['exit']=1;self.f.js(Path(records['verify']['path']),record);records['verify']=a.binding(Path(records['verify']['path']))
  with self.assertRaises(ValueError):s.validate_postseal(base,records,self.output)
 def test_empty_display_does_not_hide_encoded_entitlements(self):
  base=self.baseline();records=self.seal();record=json.loads(Path(records['display']['path']).read_text());path=Path(record['stdout']['path']);path.write_bytes(b'');record['stdout']=a.binding(path);self.f.js(Path(records['display']['path']),record);records['display']=a.binding(Path(records['display']['path']))
  with self.assertRaises(ValueError):s.validate_postseal(base,records,self.output)
 def test_resource_image_bytes_are_immutable(self):
  base=self.baseline();records=self.seal();(self.app/'Contents/Resources/issuer-package.dmg').write_bytes(b'SYNTHETIC CHANGED IMAGE')
  with self.assertRaisesRegex(ValueError,'authoritative_or_resource_changed'):s.validate_postseal(base,records,self.output)
 def test_original_leaf_mode_is_immutable(self):
  base=self.baseline();records=self.seal();(self.app/'Contents/MacOS/AxiomIssuerController').chmod(0o700)
  with self.assertRaisesRegex(ValueError,'authoritative_or_resource_changed'):s.validate_postseal(base,records,self.output)
 def test_wrong_display_team_refuses_even_successful_commands(self):
  base=self.baseline();records=self.seal();record=json.loads(Path(records['display']['path']).read_text());path=Path(record['stderr']['path']);path.write_bytes(path.read_bytes().replace(b'FG5N98FE6W',b'WRONGTEAM'));record['stderr']=a.binding(path);self.f.js(Path(records['display']['path']),record);records['display']=a.binding(Path(records['display']['path']))
  with self.assertRaisesRegex(ValueError,'seal_display_identity_mismatch'):s.validate_postseal(base,records,self.output)
 def test_failed_key_sequence_is_never_replayed(self):
  base=self.baseline();failure={'argv':s.commands()['sign'],'state':'completed','exit':1,'cleanup':'reaped_original_child','errorType':None,'stdout':b'','stderr':b'REFUSED'}
  with patch.object(s,'_run',return_value=failure)as run:
   with self.assertRaisesRegex(ValueError,'seal_tool_failed_unknown_no_retry'):s.execute_sequence(base,self.output)
   with self.assertRaises(FileExistsError):s.execute_sequence(base,self.output)
   self.assertEqual(run.call_count,1)
 def test_unexpected_file_and_unsafe_alias_refuse(self):
  base=self.baseline();records=self.seal();(self.app/'extra').write_bytes(b'NEW')
  with self.assertRaises(ValueError):s.validate_postseal(base,records,self.output)

class FinalSealRunnerTests(unittest.TestCase):
 def exercise(self,overflow=False):
  from types import SimpleNamespace
  from unittest.mock import Mock
  import signal
  class Pipe:
   def __init__(self,n):self.n=n
   def fileno(self):return self.n
   def close(self):pass
  class Selector:
   def __init__(self):self.entries={}
   def register(self,p,event,name):self.entries[p]=SimpleNamespace(fileobj=p,data=name)
   def get_map(self):return self.entries
   def select(self,t):return [(v,1)for v in list(self.entries.values())]
   def unregister(self,p):self.entries.pop(p)
   def close(self):pass
  child=SimpleNamespace(pid=424242,returncode=None,stdout=Pipe(101),stderr=Pipe(102));child.kill=Mock()
  def wait(timeout):child.returncode=0;return 0
  child.wait=Mock(side_effect=wait)
  with patch.object(s.subprocess,'Popen',return_value=child)as launch,patch.object(s.selectors,'DefaultSelector',return_value=Selector()),patch.object(s.os,'set_blocking'),patch.object(s.os,'read',return_value=b'12345678X'if overflow else b''),patch.object(s.os,'killpg')as no_signal,patch.object(s.time,'monotonic',return_value=0),patch.object(s.signal,'getsignal',return_value=signal.SIG_DFL),patch.object(s,'CAP',8):
   r=s._run('sign');no_signal.assert_not_called();launch.assert_called_once();self.assertEqual(launch.call_args.args[0],s.commands()['sign'])
  return r,child
 def test_output_cap_and_unreaped_owned_child_only(self):
  r,p=self.exercise(True);self.assertEqual(r['stdout'],b'12345678');self.assertEqual(r['state'],'output_bound');p.kill.assert_called_once()
 def test_reaped_child_never_killed(self):
  r,p=self.exercise();self.assertEqual(r['cleanup'],'reaped_original_child');p.kill.assert_not_called()
if __name__=='__main__':unittest.main()
