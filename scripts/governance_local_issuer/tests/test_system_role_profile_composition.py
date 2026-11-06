"""Actual package reader with synthetic files only; no compiler/key/runtime calls."""
from pathlib import Path
import sys,json,hashlib,unittest
sys.path.insert(0,str(Path(__file__).parents[2]));sys.path.insert(0,str(Path(__file__).parent))
from test_system_build_inputs import SystemBuildInputsTests
from test_saved_profile_observation import fixture as guard_fixture,ID as GUARD_ID,TEAM
from governance_local_issuer import system_build_inputs as s,saved_profile_observation as profiles
LEAVES=('owner','maintenance','bootstrap','guard')
class RoleCompositionTests(unittest.TestCase):
 write=SystemBuildInputsTests.write
 json=SystemBuildInputsTests.json
 record=SystemBuildInputsTests.record
 def setUp(self):
  SystemBuildInputsTests.setUp(self);packet=json.loads(self.packet.read_text());roles=packet['roles']
  for role in LEAVES:
   item=roles[role];resultpath=Path(item['resultReceipt']['path']);result=json.loads(resultpath.read_text())
   if role=='guard':
    Path(item['artifact']['path']).write_bytes(guard_fixture());item['artifact']=s.binding(Path(item['artifact']['path']));cdhash=profiles.inspect_guard_no_entitlements(guard_fixture(),GUARD_ID,TEAM)['cdhash']
   else:cdhash='1'*40
   stderr=Path(item['displayStderr']['path'])
   stderr.write_text('Identifier='+item['identifier']+'\nTeamIdentifier=FG5N98FE6W\nCDHash='+cdhash+'\nFormat=Mach-O thin (arm64)\nCodeDirectory flags=0x10000(runtime)\nInfo.plist=not bound\nSealed Resources=none\n')
   item['displayStderr']=s.binding(stderr);item['rawLogs'][2]['stderr']=s.binding(stderr)
   result['artifact_after']=item['artifact'];result['results'][2]['stderr_bytes']=stderr.stat().st_size
   resultpath.write_text(json.dumps(result));item['resultReceipt']=s.binding(resultpath)
   commands=result['results'];saved=self.json(role+'-commands-v2',commands);item['provenance']['savedCommands']=s.binding(saved)
   compilation=Path(item['provenance']['compileReceipt']['path']);comp=json.loads(compilation.read_text());source=Path(comp['artifact']['path']);source.parent.mkdir(parents=True,exist_ok=True)
   source.write_bytes(('UNSIGNED '+role).encode().ljust(32,b'\0'));source.chmod(0o600);unsigned=s.binding(source)
   comp['artifact']=unsigned;compilation.write_text(json.dumps(comp));item['provenance']['compileReceipt']=s.binding(compilation)
   signing=self.json(role+'-separate-signing-packet',{'target':item['artifact']['path'],'artifact':unsigned,'commands':[c['argv']for c in commands]});item['provenance']['signingPacket']=s.binding(signing)
  packet['format']='axiom.system-build-packet/2';packet.pop('guardSupplement');packet.pop('guardHistoricalResult')
  from governance_local_issuer.system_role_profiles import observe_role_profiles
  self.observation=observe_role_profiles({role:roles[role]for role in LEAVES},packet['preparationReceipts'])
  self.observation_path=self.json('role-observations-v2',self.observation);packet['profileObservations']=s.binding(self.observation_path)
  self.packet.write_text(json.dumps(packet))
 def save_observation(self,value):
  self.observation_path.write_text(json.dumps(value));packet=json.loads(self.packet.read_text());packet['profileObservations']=s.binding(self.observation_path);self.packet.write_text(json.dumps(packet))
 def test_v2_composes_real_distinct_packets_without_fake_failure(self):
  packet=json.loads(self.packet.read_text());self.assertEqual(len({packet['roles'][r]['provenance']['signingPacket']['sha256']for r in LEAVES}),4)
  r=self.record();self.assertEqual(r,s.verify_system_inputs(self.stage));self.assertFalse(r['executionAuthorized']);self.assertFalse(r['installationReady'])
 def test_v2_swapped_signing_result_or_preimage_proof_refuses(self):
  for field in ('signingPacket','resultReceipt','sourceArtifact'):
   v=json.loads(json.dumps(self.observation));v['representations'][0][field]=v['representations'][1][field];self.save_observation(v)
   with self.assertRaises(ValueError):self.record()
 def test_v2_missing_extra_and_duplicate_roles_refuse(self):
  for entries in (self.observation['representations'][:-1],self.observation['representations']+[self.observation['representations'][0]],self.observation['representations'][:-1]+[self.observation['representations'][0]]):
   v={**self.observation,'representations':entries};self.save_observation(v)
   with self.assertRaises(ValueError):self.record()
 def test_v2_numeric_false_does_not_equal_closed_boolean(self):
  v=json.loads(json.dumps(self.observation));v['executionAuthorized']=0;self.save_observation(v)
  with self.assertRaises(ValueError):self.record()
 def test_v2_legacy_reconciliation_fields_refuse(self):
  packet=json.loads(self.packet.read_text());packet['guardHistoricalResult']={};self.packet.write_text(json.dumps(packet))
  with self.assertRaises(ValueError):self.record()
 def test_v2_fresh_source_preimage_change_refuses(self):
  r=self.record();source=Path(self.observation['representations'][0]['sourceArtifact']['path']);source.write_bytes(b'CHANGED PREIMAGE')
  with self.assertRaises(ValueError):s.verify_system_inputs(self.stage)
 def test_v2_changed_raw_signing_log_refuses(self):
  self.record();(self.root/'owner-0-stderr').write_bytes(b'CHANGED RAW')
  with self.assertRaises(ValueError):s.verify_system_inputs(self.stage)
# Run only this class's named v2 cases; legacy class is separately exercised.
if __name__=='__main__':
 names=[n for n in RoleCompositionTests.__dict__ if n.startswith('test_v2_')]
 result=unittest.TextTestRunner().run(unittest.TestSuite(RoleCompositionTests(n)for n in names));sys.exit(not result.wasSuccessful())
